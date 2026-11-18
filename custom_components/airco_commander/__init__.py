"""Airco Commander.

A full-screen-capable airco card with the timers an airco app has (a daily
turn-off time and a sleep timer), for any `climate` entity. One config entry
per airco. The timers run inside Home Assistant, survive restarts, and do not
need the dashboard to be open. The card ships inside the integration and is
registered as a Lovelace resource automatically.
"""
from __future__ import annotations

from datetime import timedelta
import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import SOURCE_INTEGRATION_DISCOVERY, ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID, EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import CoreState, Event, HomeAssistant, ServiceCall, callback
from homeassistant.helpers import discovery_flow
from homeassistant.exceptions import ServiceValidationError
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import (
    CARD_FILENAME,
    CONF_CANCEL_SLEEP_ON_OFF,
    CONF_CATCH_UP_MINUTES,
    CONF_CLIMATE_ENTITY,
    DEFAULT_CANCEL_SLEEP_ON_OFF,
    DEFAULT_CATCH_UP_MINUTES,
    DOMAIN,
    FRONTEND_URL_BASE,
    SERVICE_CANCEL_SLEEP_TIMER,
    SERVICE_SET_OFF_TIMER,
    SERVICE_START_SLEEP_TIMER,
)
from .detection import LINKS, wfrac_climates
from .frontend import AircoCommanderCardView, LovelaceResourceRegistration
from .manager import AircoTimers
from .schedule import parse_duration_minutes, parse_time

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR, Platform.SWITCH, Platform.TIME]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


def _time_string(value):
    try:
        return parse_time(value)
    except (TypeError, ValueError) as err:
        raise vol.Invalid(str(err)) from err


def _duration(value):
    try:
        return parse_duration_minutes(value)
    except (TypeError, ValueError) as err:
        raise vol.Invalid(str(err)) from err


START_SLEEP_SCHEMA = vol.Schema(
    {vol.Required(ATTR_ENTITY_ID): cv.entity_id, vol.Required("duration"): _duration}
)
CANCEL_SLEEP_SCHEMA = vol.Schema({vol.Required(ATTR_ENTITY_ID): cv.entity_id})
SET_OFF_TIMER_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_id,
        vol.Optional("time"): _time_string,
        vol.Optional("enabled"): cv.boolean,
    }
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hass.data.setdefault(DOMAIN, {})

    def _timers_for(call: ServiceCall) -> AircoTimers:
        entity_id = call.data[ATTR_ENTITY_ID]
        for timers in hass.data.get(DOMAIN, {}).values():
            if timers.climate_entity == entity_id:
                return timers
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="unknown_airco",
            translation_placeholders={"entity_id": entity_id},
        )

    async def start_sleep(call: ServiceCall) -> None:
        await _timers_for(call).async_start_sleep(call.data["duration"])

    async def cancel_sleep(call: ServiceCall) -> None:
        await _timers_for(call).async_cancel_sleep()

    async def set_off_timer(call: ServiceCall) -> None:
        await _timers_for(call).async_set_off_timer(
            at=call.data.get("time"), enabled=call.data.get("enabled")
        )

    hass.services.async_register(DOMAIN, SERVICE_START_SLEEP_TIMER, start_sleep, START_SLEEP_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_CANCEL_SLEEP_TIMER, cancel_sleep, CANCEL_SLEEP_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_SET_OFF_TIMER, set_off_timer, SET_OFF_TIMER_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})
    options = {**entry.data, **entry.options}
    timers = AircoTimers(
        hass,
        entry.entry_id,
        entry.data[CONF_CLIMATE_ENTITY],
        cancel_sleep_on_off=options.get(CONF_CANCEL_SLEEP_ON_OFF, DEFAULT_CANCEL_SLEEP_ON_OFF),
        catch_up=timedelta(minutes=options.get(CONF_CATCH_UP_MINUTES, DEFAULT_CATCH_UP_MINUTES)),
    )
    timers.links = {key: options.get(key) for key in LINKS}
    await timers.async_setup()
    hass.data[DOMAIN][entry.entry_id] = timers
    _async_schedule_discovery(hass)

    await _async_register_frontend(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


@callback
def _async_schedule_discovery(hass: HomeAssistant) -> None:
    """Offer every other WF-RAC airco as a discovered device, once per run.
    Already added or ignored aircos are filtered out by the flow itself."""
    if hass.data.get(f"{DOMAIN}_discovery_done"):
        return
    hass.data[f"{DOMAIN}_discovery_done"] = True

    @callback
    def _discover(_event: Event | None = None) -> None:
        for entity_id in wfrac_climates(hass):
            discovery_flow.async_create_flow(
                hass,
                DOMAIN,
                context={"source": SOURCE_INTEGRATION_DISCOVERY},
                data={"entity_id": entity_id},
            )

    if hass.state is CoreState.running:
        _discover()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _discover)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    timers: AircoTimers = hass.data[DOMAIN].pop(entry.entry_id)
    await timers.async_unload()
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Deleting the airco also deletes its stored timers."""
    from homeassistant.helpers.storage import Store

    from .const import STORAGE_KEY, STORAGE_VERSION

    await Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}.{entry.entry_id}").async_remove()


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled card and register it as a Lovelace resource. See
    frontend.py for why it is a resource and not add_extra_js_url."""
    if hass.data.get(f"{DOMAIN}_frontend_registered"):
        return
    hass.data[f"{DOMAIN}_frontend_registered"] = True

    www_path = Path(__file__).parent / "www"
    integration = await async_get_integration(hass, DOMAIN)
    js_path = f"{FRONTEND_URL_BASE}/{CARD_FILENAME}"
    hass.http.register_view(AircoCommanderCardView(js_path, www_path / CARD_FILENAME))
    # Fonts never change within a version, so these may be cached normally.
    from homeassistant.components.http import StaticPathConfig

    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"{FRONTEND_URL_BASE}/fonts", str(www_path / "fonts"), True)]
    )

    registered = await LovelaceResourceRegistration(hass, js_path).async_try_register(
        str(integration.version)
    )
    if not registered:
        js_url = f"{js_path}?v={integration.version}"
        try:
            from homeassistant.components.frontend import add_extra_js_url

            add_extra_js_url(hass, js_url)
        except ImportError:
            pass
    _LOGGER.info("Airco Commander card served at %s (Lovelace resource: %s)", js_path, registered)
