"""Tests for the pure timer arithmetic (no Home Assistant needed)."""
from __future__ import annotations

from datetime import datetime, time, timedelta
import importlib.util
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

# Load schedule.py on its own, without importing the package __init__ (which
# needs Home Assistant).
_SPEC = importlib.util.spec_from_file_location(
    "airco_schedule",
    Path(__file__).parents[1] / "custom_components" / "airco_commander" / "schedule.py",
)
schedule = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(schedule)

AMS = ZoneInfo("Europe/Amsterdam")


def test_next_occurrence_later_today():
    now = datetime(2026, 11, 18, 20, 0, tzinfo=AMS)
    assert schedule.next_daily_occurrence(now, time(22, 0)) == datetime(2026, 11, 18, 22, 0, tzinfo=AMS)


def test_next_occurrence_rolls_to_tomorrow():
    now = datetime(2026, 11, 18, 22, 0, tzinfo=AMS)
    assert schedule.next_daily_occurrence(now, time(22, 0)) == datetime(2026, 11, 19, 22, 0, tzinfo=AMS)


def test_next_occurrence_keeps_wall_clock_over_dst():
    # Night of 24 -> 25 October 2026: clocks go back one hour.
    now = datetime(2026, 10, 24, 23, 0, tzinfo=AMS)
    nxt = schedule.next_daily_occurrence(now, time(22, 0))
    assert nxt.hour == 22 and nxt.day == 25
    utc = ZoneInfo("UTC")
    # 23 wall-clock hours, plus the hour the clocks go back.
    assert nxt.astimezone(utc) - now.astimezone(utc) == timedelta(hours=24)


def test_next_occurrence_requires_aware():
    with pytest.raises(ValueError):
        schedule.next_daily_occurrence(datetime(2026, 1, 1, 12, 0), time(22, 0))


@pytest.mark.parametrize(
    ("due_offset", "expected"),
    [
        (None, False),
        (timedelta(minutes=5), False),  # still in the future
        (timedelta(minutes=-5), True),
        (timedelta(minutes=-120), True),  # exactly at the window edge
        (timedelta(minutes=-121), False),
    ],
)
def test_missed_while_down(due_offset, expected):
    now = datetime(2026, 11, 18, 23, 0, tzinfo=AMS)
    due = None if due_offset is None else now + due_offset
    assert schedule.missed_while_down(due, now, timedelta(minutes=120)) is expected


def test_missed_while_down_window_zero_disables_catch_up():
    now = datetime(2026, 11, 18, 23, 0, tzinfo=AMS)
    assert schedule.missed_while_down(now - timedelta(seconds=1), now, timedelta(0)) is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [("22:00", time(22, 0)), ("7:05", time(7, 5)), ("23:30:00", time(23, 30)), (time(6, 15, 42), time(6, 15))],
)
def test_parse_time(value, expected):
    assert schedule.parse_time(value) == expected


@pytest.mark.parametrize("value", ["", "22", "25:00", "aa:bb"])
def test_parse_time_invalid(value):
    with pytest.raises(ValueError):
        schedule.parse_time(value)


@pytest.mark.parametrize(
    ("value", "expected"),
    [(90, 90), (60.0, 60), ("45", 45), ("1:30", 90), ("01:00", 60), ("24:00", 1440)],
)
def test_parse_duration(value, expected):
    assert schedule.parse_duration_minutes(value) == expected


@pytest.mark.parametrize("value", [0, -5, "0:00", 1441, "25:00"])
def test_parse_duration_out_of_range(value):
    with pytest.raises(ValueError):
        schedule.parse_duration_minutes(value)
