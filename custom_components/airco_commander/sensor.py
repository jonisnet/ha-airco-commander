"""When the airco is next turned off: by the sleep timer, and by the daily time."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import AircoCommanderEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    timers = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            SleepTimerSensor(hass, entry, timers, "sleep_timer"),
            NextOffSensor(hass, entry, timers, "next_off"),
        ]
    )


class SleepTimerSensor(AircoCommanderEntity, SensorEntity):
    """End of the running sleep timer; unknown while none runs."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:timer-sand"

    @property
    def native_value(self) -> datetime | None:
        return self.timers.sleep_end

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            **super().extra_state_attributes,
            "duration_minutes": self.timers.sleep_minutes,
            "last_turn_off": self.timers.last_turn_off,
        }


class NextOffSensor(AircoCommanderEntity, SensorEntity):
    """Next moment the daily turn-off time fires; unknown while it is off."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:clock-end"

    @property
    def native_value(self) -> datetime | None:
        return self.timers.off_next_due if self.timers.off_enabled else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            **super().extra_state_attributes,
            "off_time": self.timers.off_time.strftime("%H:%M"),
            "enabled": self.timers.off_enabled,
        }
