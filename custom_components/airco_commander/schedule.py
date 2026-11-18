"""Pure timer arithmetic, kept free of Home Assistant imports so it can be
tested on its own."""
from __future__ import annotations

from datetime import datetime, time, timedelta


def next_daily_occurrence(now: datetime, at: time) -> datetime:
    """The first moment strictly after `now` whose wall-clock time is `at`,
    in `now`'s own time zone. Uses wall-clock dates so a DST change moves the
    absolute instant, not the time on the clock."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    candidate = datetime.combine(now.date(), at, tzinfo=now.tzinfo)
    if candidate <= now:
        candidate = datetime.combine(now.date() + timedelta(days=1), at, tzinfo=now.tzinfo)
    return candidate


def missed_while_down(due: datetime | None, now: datetime, window: timedelta) -> bool:
    """True if `due` already passed and is recent enough to still act on."""
    if due is None:
        return False
    return due <= now and now - due <= window


def parse_time(value: str | time) -> time:
    """Accept a `time` or an "HH:MM" / "HH:MM:SS" string."""
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    parts = str(value).strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"Invalid time: {value!r}")
    hour, minute = int(parts[0]), int(parts[1])
    return time(hour, minute)


def parse_duration_minutes(value: str | int | float) -> int:
    """Accept minutes as a number, or a duration as "H:MM" / "HH:MM"."""
    if isinstance(value, (int, float)):
        minutes = int(round(value))
    else:
        text = str(value).strip()
        if ":" in text:
            hours, mins = text.split(":")[:2]
            minutes = int(hours) * 60 + int(mins)
        else:
            minutes = int(round(float(text)))
    if not 1 <= minutes <= 24 * 60:
        raise ValueError("Duration must be between 1 minute and 24 hours")
    return minutes
