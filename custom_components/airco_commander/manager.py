"""The timers of one airco: a daily fixed turn-off time and a sleep timer.

Everything that has to survive a restart is written to its own storage file
the moment it changes (not on a delay, and not through RestoreEntity, which
only saves every 15 minutes and on a clean shutdown). After a restart the
stored due-moments are re-armed; one that came due while Home Assistant was
down is carried out once it is running again, if it is recent enough
(see DEFAULT_CATCH_UP_MINUTES).
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, time, timedelta
import logging
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, STATE_OFF
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_utc_time,
    async_track_state_change_event,
)
from homeassistant.helpers.storage import Store
import homeassistant.util.dt as dt_util

from .const import (
    DEFAULT_OFF_TIME,
    SIGNAL_UPDATE,
    STORAGE_KEY,
    STORAGE_VERSION,
    TURN_OFF_MAX_ATTEMPTS,
    TURN_OFF_VERIFY_DELAY,
)
from .schedule import missed_while_down, next_daily_occurrence, parse_time

_LOGGER = logging.getLogger(__name__)

REASON_OFF_TIME = "off_time"
REASON_SLEEP = "sleep_timer"


def _dt_to_str(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _str_to_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = dt_util.parse_datetime(value)
    return dt_util.as_utc(parsed) if parsed else None


class AircoTimers:
    """Owns and schedules the timers of one climate entity."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry_id: str,
        climate_entity: str,
        *,
        cancel_sleep_on_off: bool,
        catch_up: timedelta,
    ) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.climate_entity = climate_entity
        self.cancel_sleep_on_off = cancel_sleep_on_off
        self.catch_up = catch_up
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{STORAGE_KEY}.{entry_id}"
        )

        self.off_time: time = DEFAULT_OFF_TIME
        self.off_enabled: bool = False
        self.off_next_due: datetime | None = None
        self.sleep_end: datetime | None = None
        self.sleep_minutes: int | None = None
        self.last_turn_off: dict[str, Any] | None = None
        self.links: dict[str, str | None] = {}

        self._unsub_off: CALLBACK_TYPE | None = None
        self._unsub_sleep: CALLBACK_TYPE | None = None
        self._unsub_verify: CALLBACK_TYPE | None = None
        self._unsub_state: CALLBACK_TYPE | None = None
        self._unsub_started: CALLBACK_TYPE | None = None
        self._pending_off: dict[str, Any] | None = None
        self._started = False

    # ------------------------------------------------------------------ setup

    async def async_setup(self) -> None:
        data = await self._store.async_load() or {}
        try:
            self.off_time = parse_time(data.get("off_time") or DEFAULT_OFF_TIME)
        except ValueError:
            self.off_time = DEFAULT_OFF_TIME
        self.off_enabled = bool(data.get("off_enabled", False))
        self.off_next_due = _str_to_dt(data.get("off_next_due"))
        self.sleep_end = _str_to_dt(data.get("sleep_end"))
        self.sleep_minutes = data.get("sleep_minutes")
        self.last_turn_off = data.get("last_turn_off")

        if self.hass.is_running:
            await self._async_start()
        else:
            self._unsub_started = self.hass.bus.async_listen_once(
                EVENT_HOMEASSISTANT_STARTED, self._async_on_started
            )

    async def _async_on_started(self, _event: Event) -> None:
        self._unsub_started = None
        await self._async_start()

    async def _async_start(self) -> None:
        """Catch up on anything missed while down, then arm the timers.
        Waits for Home Assistant to have started, so the climate entity of
        the other integration exists before it is switched."""
        self._started = True
        now = dt_util.utcnow()
        turn_off_reason: str | None = None

        if self.sleep_end is not None and self.sleep_end <= now:
            if missed_while_down(self.sleep_end, now, self.catch_up):
                _LOGGER.info(
                    "%s: sleep timer ran out at %s while Home Assistant was down, turning off now",
                    self.climate_entity,
                    self.sleep_end,
                )
                turn_off_reason = REASON_SLEEP
            else:
                _LOGGER.info(
                    "%s: sleep timer ran out at %s, too long ago to still act on",
                    self.climate_entity,
                    self.sleep_end,
                )
            self.sleep_end = None
            self.sleep_minutes = None

        if self.off_enabled:
            if self.off_next_due is not None and self.off_next_due <= now:
                if missed_while_down(self.off_next_due, now, self.catch_up):
                    _LOGGER.info(
                        "%s: turn-off time %s passed while Home Assistant was down, turning off now",
                        self.climate_entity,
                        self.off_next_due,
                    )
                    turn_off_reason = turn_off_reason or REASON_OFF_TIME
                self.off_next_due = None
            if self.off_next_due is None:
                self.off_next_due = self._compute_next_off()
        else:
            self.off_next_due = None

        self._unsub_state = async_track_state_change_event(
            self.hass, [self.climate_entity], self._async_climate_changed
        )
        self._arm_off()
        self._arm_sleep()
        await self._async_save()
        self._notify()

        if turn_off_reason:
            await self._async_turn_off(turn_off_reason)

    async def async_unload(self) -> None:
        for unsub in (
            self._unsub_off,
            self._unsub_sleep,
            self._unsub_verify,
            self._unsub_state,
            self._unsub_started,
        ):
            if unsub:
                unsub()
        self._unsub_off = self._unsub_sleep = self._unsub_verify = None
        self._unsub_state = self._unsub_started = None

    # ------------------------------------------------------------- public API

    async def async_set_off_timer(
        self, at: time | str | None = None, enabled: bool | None = None
    ) -> None:
        if at is not None:
            self.off_time = parse_time(at)
        if enabled is not None:
            self.off_enabled = enabled
        self.off_next_due = self._compute_next_off() if self.off_enabled else None
        self._arm_off()
        await self._async_save()
        self._notify()

    async def async_start_sleep(self, minutes: int) -> None:
        self.sleep_minutes = minutes
        self.sleep_end = dt_util.utcnow() + timedelta(minutes=minutes)
        self._arm_sleep()
        await self._async_save()
        self._notify()

    async def async_cancel_sleep(self) -> None:
        self.sleep_end = None
        self.sleep_minutes = None
        self._arm_sleep()
        await self._async_save()
        self._notify()

    # -------------------------------------------------------------- internals

    def _compute_next_off(self) -> datetime:
        local_now = dt_util.now()
        return dt_util.as_utc(next_daily_occurrence(local_now, self.off_time))

    def _arm_off(self) -> None:
        if self._unsub_off:
            self._unsub_off()
            self._unsub_off = None
        if self._started and self.off_enabled and self.off_next_due:
            self._unsub_off = async_track_point_in_utc_time(
                self.hass, self._async_off_time_reached, self.off_next_due
            )

    def _arm_sleep(self) -> None:
        if self._unsub_sleep:
            self._unsub_sleep()
            self._unsub_sleep = None
        if self._started and self.sleep_end:
            self._unsub_sleep = async_track_point_in_utc_time(
                self.hass, self._async_sleep_reached, self.sleep_end
            )

    async def _async_off_time_reached(self, _now: datetime) -> None:
        self._unsub_off = None
        self.off_next_due = self._compute_next_off()
        self._arm_off()
        await self._async_save()
        self._notify()
        await self._async_turn_off(REASON_OFF_TIME)

    async def _async_sleep_reached(self, _now: datetime) -> None:
        self._unsub_sleep = None
        self.sleep_end = None
        self.sleep_minutes = None
        await self._async_save()
        self._notify()
        await self._async_turn_off(REASON_SLEEP)

    async def _async_turn_off(self, reason: str, attempt: int = 1) -> None:
        state = self.hass.states.get(self.climate_entity)
        if state is not None and state.state == STATE_OFF:
            _LOGGER.debug("%s: already off (%s)", self.climate_entity, reason)
            self._pending_off = None
            return

        _LOGGER.info(
            "%s: turning off (%s, attempt %s)", self.climate_entity, reason, attempt
        )
        self._pending_off = {"reason": reason, "attempt": attempt}
        self.last_turn_off = {
            "reason": reason,
            "at": dt_util.utcnow().isoformat(),
            "attempt": attempt,
        }
        await self._async_save()
        self._notify()
        try:
            await self.hass.services.async_call(
                "climate",
                "turn_off",
                {"entity_id": self.climate_entity},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001 - retried below
            _LOGGER.warning(
                "%s: turning off failed (%s, attempt %s): %s",
                self.climate_entity,
                reason,
                attempt,
                err,
            )

        if self._unsub_verify:
            self._unsub_verify()
        self._unsub_verify = async_call_later(
            self.hass, TURN_OFF_VERIFY_DELAY, self._async_verify_off
        )

    async def _async_verify_off(self, _now: datetime) -> None:
        """Retry a turn-off that never showed up as an `off` state - a unit
        that was locked by its app, or briefly unreachable."""
        self._unsub_verify = None
        pending = self._pending_off
        if pending is None:
            return
        state = self.hass.states.get(self.climate_entity)
        if state is not None and state.state == STATE_OFF:
            self._pending_off = None
            return
        if pending["attempt"] >= TURN_OFF_MAX_ATTEMPTS:
            _LOGGER.error(
                "%s: still not off after %s attempts (%s), giving up",
                self.climate_entity,
                pending["attempt"],
                pending["reason"],
            )
            self._pending_off = None
            return
        await self._async_turn_off(pending["reason"], pending["attempt"] + 1)

    @callback
    def _async_climate_changed(self, event: Event) -> None:
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")
        if new_state is None or new_state.state != STATE_OFF:
            return
        # The unit reached `off`: a pending turn-off is done, and nobody gets
        # a second one if they switch it back on right after.
        self._pending_off = None
        if self._unsub_verify:
            self._unsub_verify()
            self._unsub_verify = None
        if (
            self.cancel_sleep_on_off
            and self.sleep_end is not None
            and old_state is not None
            and old_state.state != STATE_OFF
        ):
            _LOGGER.debug("%s: turned off, sleep timer cancelled", self.climate_entity)
            self.hass.async_create_task(self.async_cancel_sleep())

    async def _async_save(self) -> None:
        await self._store.async_save(
            {
                "off_time": self.off_time.strftime("%H:%M"),
                "off_enabled": self.off_enabled,
                "off_next_due": _dt_to_str(self.off_next_due),
                "sleep_end": _dt_to_str(self.sleep_end),
                "sleep_minutes": self.sleep_minutes,
                "last_turn_off": self.last_turn_off,
            }
        )

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, SIGNAL_UPDATE.format(self.entry_id))

    def add_listener(self, update: Callable[[], None]) -> CALLBACK_TYPE:
        """Convenience for entities: subscribe to timer changes."""
        return async_dispatcher_connect(
            self.hass, SIGNAL_UPDATE.format(self.entry_id), update
        )
