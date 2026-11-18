"""Turns the daily turn-off time on or off."""
from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import AircoCommanderEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    timers = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([OffTimeEnabledSwitch(hass, entry, timers, "off_time_enabled")])


class OffTimeEnabledSwitch(AircoCommanderEntity, SwitchEntity):
    _attr_icon = "mdi:clock-check-outline"

    @property
    def is_on(self) -> bool:
        return self.timers.off_enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self.timers.async_set_off_timer(enabled=True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.timers.async_set_off_timer(enabled=False)
