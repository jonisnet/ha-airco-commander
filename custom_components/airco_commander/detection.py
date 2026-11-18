"""Finds the entities that belong to an airco.

For a Mitsubishi WF-RAC unit the integration's own translation keys identify
each entity exactly. For any other airco the device's entities are matched on
device class and name instead. Only entities on the airco's own device are
considered, so a sensor of another room can never be picked up by accident.
"""
from __future__ import annotations

from dataclasses import dataclass
import re

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

WFRAC_PLATFORM = "mitsubishi_wf_rac"

LINK_OUTDOOR = "outdoor_sensor"
LINK_HOME_LEAVE = "home_leave_select"
LINK_ENERGY = "energy_sensor"
LINKS = (LINK_OUTDOOR, LINK_HOME_LEAVE, LINK_ENERGY)

_OUTDOOR_WORDS = re.compile(r"outdoor|outside|buiten|aussen|außen|exterieur|extérieur", re.I)


@dataclass
class Detected:
    links: dict[str, str | None]
    platform: str | None
    device_id: str | None


def _name(entry: er.RegistryEntry) -> str:
    return " ".join(filter(None, [entry.entity_id, entry.original_name, entry.name, entry.translation_key]))


def _device_class(entry: er.RegistryEntry) -> str | None:
    return entry.device_class or entry.original_device_class


def detect_links(hass: HomeAssistant, climate_entity: str) -> Detected:
    registry = er.async_get(hass)
    climate = registry.async_get(climate_entity)
    links: dict[str, str | None] = {key: None for key in LINKS}
    if climate is None or climate.device_id is None:
        return Detected(links, climate.platform if climate else None, None)

    siblings = [
        e
        for e in er.async_entries_for_device(registry, climate.device_id)
        if e.entity_id != climate_entity and not e.disabled_by
    ]

    by_key = {(e.platform, e.translation_key): e.entity_id for e in siblings}
    links[LINK_OUTDOOR] = by_key.get((WFRAC_PLATFORM, "outdoor"))
    links[LINK_HOME_LEAVE] = by_key.get((WFRAC_PLATFORM, "home_leave_mode"))
    links[LINK_ENERGY] = by_key.get((WFRAC_PLATFORM, "energy_usage_total"))

    sensors = [e for e in siblings if e.domain == "sensor"]
    if links[LINK_OUTDOOR] is None:
        links[LINK_OUTDOOR] = next(
            (
                e.entity_id
                for e in sensors
                if _device_class(e) == "temperature" and _OUTDOOR_WORDS.search(_name(e))
            ),
            None,
        )
    if links[LINK_ENERGY] is None:
        energy = [e for e in sensors if _device_class(e) == "energy"]
        # Prefer a running total over a per-run counter.
        energy.sort(key=lambda e: 0 if "total" in _name(e).lower() else 1)
        links[LINK_ENERGY] = energy[0].entity_id if energy else None
    if links[LINK_HOME_LEAVE] is None:
        for e in siblings:
            if e.domain != "select":
                continue
            state = hass.states.get(e.entity_id)
            options = state.attributes.get("options", []) if state else []
            if "away_heat" in options or "away_cool" in options:
                links[LINK_HOME_LEAVE] = e.entity_id
                break

    return Detected(links, climate.platform, climate.device_id)


def wfrac_climates(hass: HomeAssistant) -> list[str]:
    """All climate entities of Mitsubishi WF-RAC units, for discovery."""
    registry = er.async_get(hass)
    return sorted(
        e.entity_id
        for e in registry.entities.values()
        if e.platform == WFRAC_PLATFORM and e.domain == "climate" and not e.disabled_by
    )
