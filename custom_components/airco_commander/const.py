"""Constants for Airco Commander."""
from __future__ import annotations

from datetime import time, timedelta

DOMAIN = "airco_commander"

CONF_CLIMATE_ENTITY = "climate_entity"
CONF_CANCEL_SLEEP_ON_OFF = "cancel_sleep_on_off"
CONF_CATCH_UP_MINUTES = "catch_up_minutes"

DEFAULT_OFF_TIME = time(22, 0)
DEFAULT_CANCEL_SLEEP_ON_OFF = True
# A timer that came due while Home Assistant was not running is still carried
# out on startup, as long as it is not older than this. Past that, turning the
# airco off would more likely undo something a person did in the meantime.
DEFAULT_CATCH_UP_MINUTES = 120

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.timers"

# The WF-RAC module (and a few other cloud-less units) refuse writes for a
# while after another client used them. A turn-off that did not land is
# retried after this delay, a limited number of times.
TURN_OFF_VERIFY_DELAY = timedelta(seconds=75)
TURN_OFF_MAX_ATTEMPTS = 4

SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"

ATTR_CLIMATE = "airco_commander_climate"
ATTR_ROLE = "airco_commander_role"

SERVICE_START_SLEEP_TIMER = "start_sleep_timer"
SERVICE_CANCEL_SLEEP_TIMER = "cancel_sleep_timer"
SERVICE_SET_OFF_TIMER = "set_off_timer"

FRONTEND_URL_BASE = "/airco_commander_static"
CARD_FILENAME = "airco-commander-card.js"
