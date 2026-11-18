"""Config flow: one entry per airco.

1. Pick the airco (or confirm one that was discovered).
2. "Links": every entity the card and the timers use, filled in from the
   airco's own device and each with what it is used for. Anything can be
   changed or cleared; the same screen is the options flow later.
"""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector

from .const import (
    CONF_CANCEL_SLEEP_ON_OFF,
    CONF_CATCH_UP_MINUTES,
    CONF_CLIMATE_ENTITY,
    DEFAULT_CANCEL_SLEEP_ON_OFF,
    DEFAULT_CATCH_UP_MINUTES,
    DOMAIN,
)
from .detection import LINK_ENERGY, LINK_HOME_LEAVE, LINK_OUTDOOR, LINKS, detect_links


def _friendly(hass: HomeAssistant, entity_id: str) -> str:
    state = hass.states.get(entity_id)
    return (state.attributes.get("friendly_name") if state else None) or entity_id


def _links_schema(hass: HomeAssistant, climate: str, current: dict[str, Any]) -> vol.Schema:
    detected = detect_links(hass, climate)

    def entity_selector(domain: str, device_class: str | None = None) -> selector.EntitySelector:
        cfg: dict[str, Any] = {"domain": domain}
        if device_class:
            cfg["device_class"] = device_class
        return selector.EntitySelector(selector.EntitySelectorConfig(**cfg))

    def suggested(key: str) -> dict[str, Any]:
        value = current[key] if key in current else detected.links.get(key)
        return {"suggested_value": value} if value else {}

    # Detection only looks on the airco's own device; by hand any entity may be chosen.
    return vol.Schema(
        {
            vol.Optional(LINK_OUTDOOR, description=suggested(LINK_OUTDOOR)): entity_selector("sensor", "temperature"),
            vol.Optional(LINK_HOME_LEAVE, description=suggested(LINK_HOME_LEAVE)): entity_selector("select"),
            vol.Optional(LINK_ENERGY, description=suggested(LINK_ENERGY)): entity_selector("sensor", "energy"),
            vol.Required(
                CONF_CANCEL_SLEEP_ON_OFF,
                default=current.get(CONF_CANCEL_SLEEP_ON_OFF, DEFAULT_CANCEL_SLEEP_ON_OFF),
            ): selector.BooleanSelector(),
            vol.Required(
                CONF_CATCH_UP_MINUTES,
                default=current.get(CONF_CATCH_UP_MINUTES, DEFAULT_CATCH_UP_MINUTES),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0, max=720, step=5, unit_of_measurement="min", mode=selector.NumberSelectorMode.BOX
                )
            ),
        }
    )


def _found_summary(hass: HomeAssistant, climate: str) -> dict[str, str]:
    detected = detect_links(hass, climate)
    found = [k for k in LINKS if detected.links.get(k)]
    return {
        "airco": _friendly(hass, climate),
        "climate": climate,
        "found": str(len(found)),
        "total": str(len(LINKS)),
    }


def _clean(user_input: dict[str, Any]) -> dict[str, Any]:
    """Cleared selectors are left out of the input; store them as None."""
    data = dict(user_input)
    for key in LINKS:
        data[key] = data.get(key) or None
    return data


class AircoCommanderConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._climate: str | None = None

    def _configured(self) -> list[str]:
        return [e.data[CONF_CLIMATE_ENTITY] for e in self._async_current_entries(include_ignore=False)]

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._climate = user_input[CONF_CLIMATE_ENTITY]
            await self.async_set_unique_id(self._climate)
            self._abort_if_unique_id_configured()
            return await self.async_step_links()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_CLIMATE_ENTITY): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="climate", exclude_entities=self._configured())
                    )
                }
            ),
        )

    async def async_step_integration_discovery(self, discovery_info: dict[str, Any]) -> ConfigFlowResult:
        self._climate = discovery_info["entity_id"]
        await self.async_set_unique_id(self._climate)
        self._abort_if_unique_id_configured()
        self.context["title_placeholders"] = {"name": _friendly(self.hass, self._climate)}
        return await self.async_step_links()

    async def async_step_links(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        assert self._climate is not None
        if user_input is not None:
            return self.async_create_entry(
                title=_friendly(self.hass, self._climate),
                data={CONF_CLIMATE_ENTITY: self._climate},
                options=_clean(user_input),
            )
        return self.async_show_form(
            step_id="links",
            data_schema=_links_schema(self.hass, self._climate, {}),
            description_placeholders=_found_summary(self.hass, self._climate),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return AircoCommanderOptionsFlow()


class AircoCommanderOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        climate = self.config_entry.data[CONF_CLIMATE_ENTITY]
        if user_input is not None:
            return self.async_create_entry(data=_clean(user_input))
        return self.async_show_form(
            step_id="init",
            data_schema=_links_schema(self.hass, climate, dict(self.config_entry.options)),
            description_placeholders=_found_summary(self.hass, climate),
        )
