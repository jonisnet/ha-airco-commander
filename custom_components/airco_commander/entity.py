"""Shared base for the Airco Commander entities."""
from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device import async_entity_id_to_device
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import ATTR_CLIMATE, ATTR_ROLE, DOMAIN
from .manager import AircoTimers


class AircoCommanderEntity(Entity):
    """Lives on the airco's own device page when it has one (the same way
    Home Assistant's own helpers attach to their source device), otherwise on
    a device of its own."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, timers: AircoTimers, key: str
    ) -> None:
        self.timers = timers
        self._attr_translation_key = key
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._role = key
        device = async_entity_id_to_device(hass, timers.climate_entity)
        if device is not None:
            self.device_entry = device
        else:
            self._attr_device_info = DeviceInfo(
                identifiers={(DOMAIN, entry.entry_id)},
                name=entry.title,
                manufacturer="Airco Commander",
            )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        attrs = {ATTR_CLIMATE: self.timers.climate_entity, ATTR_ROLE: self._role}
        # The links chosen in the integration, so the card uses exactly the
        # same entities: airco_commander_outdoor_sensor etc.
        for key, entity_id in self.timers.links.items():
            attrs[f"airco_commander_{key}"] = entity_id
        return attrs

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.timers.add_listener(self._handle_update))

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()
