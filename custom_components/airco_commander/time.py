"""The daily turn-off time."""
from __future__ import annotations

from datetime import time

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import AircoCommanderEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    timers = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([OffTimeEntity(hass, entry, timers, "off_time")])


class OffTimeEntity(AircoCommanderEntity, TimeEntity):
    _attr_icon = "mdi:clock-end"

    @property
    def native_value(self) -> time:
        return self.timers.off_time

    async def async_set_value(self, value: time) -> None:
        await self.timers.async_set_off_timer(at=value)
