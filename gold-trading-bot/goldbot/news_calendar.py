"""Wirtschaftskalender-Filter: keine neuen Trades rund um wichtige US-Termine.

Bei Zinsentscheiden (FOMC), Inflationsdaten (CPI) oder dem Arbeitsmarktbericht
(NFP) springt Gold oft in Sekunden um viele Dollar, Spreads weiten sich aus und
Stops werden schlechter ausgeführt. Der Bot eröffnet deshalb in einem Zeitfenster
um solche Termine keine neuen Positionen.

Quellen:
- Live: kostenloser Wochenkalender von ForexFactory (JSON), stündlich aktualisiert.
  Jeder abgerufene Termin wird in data/calendar_events.csv gesammelt, damit spätere
  Backtests echte Termine kennen.
- Fallback und Backtest: eingebaute Regeln für NFP (1. Freitag im Monat, 8:30 New
  Yorker Zeit) und die FOMC-Termine 2023–2026 (14:00 New Yorker Zeit). Das ist
  eine Näherung – Verschiebungen (z. B. Feiertage) sind nicht enthalten.
"""

from __future__ import annotations

import bisect
import logging
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pandas as pd
import requests

log = logging.getLogger(__name__)

FOREXFACTORY_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
NEW_YORK = ZoneInfo("America/New_York")

# Tag der Zinsentscheidung (2. Sitzungstag), Bekanntgabe 14:00 New York. Ohne Gewähr.
FOMC_DECISION_DAYS = [
    "2023-02-01", "2023-03-22", "2023-05-03", "2023-06-14", "2023-07-26", "2023-09-20", "2023-11-01", "2023-12-13",
    "2024-01-31", "2024-03-20", "2024-05-01", "2024-06-12", "2024-07-31", "2024-09-18", "2024-11-07", "2024-12-18",
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18", "2025-07-30", "2025-09-17", "2025-10-29", "2025-12-10",
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
]


@dataclass(frozen=True)
class Event:
    time: pd.Timestamp  # UTC
    title: str
    country: str = "USD"
    impact: str = "High"


class EventCalendar:
    """Sagt, ob ein Zeitpunkt im Sperrfenster eines Termins liegt."""

    def __init__(self, events: list[Event], minutes_before: int = 60, minutes_after: int = 30):
        self.before = pd.Timedelta(minutes=minutes_before)
        self.after = pd.Timedelta(minutes=minutes_after)
        self.set_events(events)

    def set_events(self, events: list[Event]) -> None:
        unique = {(e.time, e.title): e for e in events}
        self.events = sorted(unique.values(), key=lambda e: e.time)
        self._times = [e.time for e in self.events]

    def blocking_event(self, when) -> Event | None:
        """Termin, der `when` sperrt (when liegt zwischen Termin - before und Termin + after)."""
        t = pd.Timestamp(when)
        t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
        # Kandidaten: Termine zwischen t - after und t + before
        i = bisect.bisect_left(self._times, t - self.after)
        if i < len(self._times) and self._times[i] <= t + self.before:
            return self.events[i]
        return None


# ------------------------------------------------------------- eingebaute Regeln
def _ny(d: date, hour: int, minute: int) -> pd.Timestamp:
    return pd.Timestamp(datetime(d.year, d.month, d.day, hour, minute, tzinfo=NEW_YORK)).tz_convert("UTC")


def static_us_events(start: date | None = None, end: date | None = None) -> list[Event]:
    start = start or date(2023, 1, 1)
    end = end or date.today() + timedelta(days=60)
    events = []
    for s in FOMC_DECISION_DAYS:
        d = date.fromisoformat(s)
        if start <= d <= end:
            events.append(Event(_ny(d, 14, 0), "FOMC Zinsentscheid"))
    y, m = start.year, start.month
    while date(y, m, 1) <= end:
        first = date(y, m, 1)
        friday = first + timedelta(days=(4 - first.weekday()) % 7)
        if start <= friday <= end:
            events.append(Event(_ny(friday, 8, 30), "US-Arbeitsmarktbericht (NFP, Näherung)"))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return events


# --------------------------------------------------------------- ForexFactory
def parse_forexfactory(items: list[dict], currencies: set[str], impacts: set[str]) -> list[Event]:
    events = []
    for it in items:
        country = str(it.get("country", "")).upper()
        impact = str(it.get("impact", "")).capitalize()
        if country not in currencies or impact not in impacts:
            continue
        try:
            t = pd.Timestamp(it["date"])
        except (KeyError, ValueError, TypeError):
            continue
        t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
        events.append(Event(t, str(it.get("title", "?")), country, impact))
    return events


def fetch_forexfactory(url: str, currencies: set[str], impacts: set[str], timeout: float = 15) -> list[Event]:
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": "goldbot/1.0"})
    resp.raise_for_status()
    return parse_forexfactory(resp.json(), currencies, impacts)


# ------------------------------------------------------------- CSV-Historie
def load_events_csv(path: str) -> list[Event]:
    if not path or not os.path.exists(path):
        return []
    df = pd.read_csv(path)
    df["time"] = pd.to_datetime(df["time"], utc=True, format="ISO8601")
    return [
        Event(r.time, str(r.title), str(getattr(r, "country", "USD")), str(getattr(r, "impact", "High")))
        for r in df.itertuples()
    ]


def save_events_csv(path: str, events: list[Event]) -> None:
    existing = {(e.time, e.title): e for e in load_events_csv(path)}
    existing.update({(e.time, e.title): e for e in events})
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    rows = sorted(existing.values(), key=lambda e: e.time)
    pd.DataFrame(
        [{"time": e.time.isoformat(), "title": e.title, "country": e.country, "impact": e.impact} for e in rows]
    ).to_csv(path, index=False)


# ------------------------------------------------------------ Live-Kalender
class LiveNewsCalendar(EventCalendar):
    """Holt den Kalender höchstens einmal pro Stunde neu. Fällt der Abruf aus,
    gelten die zuletzt geladenen Termine plus die eingebauten Regeln."""

    def __init__(
        self,
        minutes_before: int,
        minutes_after: int,
        currencies: set[str],
        impacts: set[str],
        url: str = FOREXFACTORY_URL,
        history_path: str = "data/calendar_events.csv",
        refresh_seconds: int = 3600,
    ):
        self.url, self.currencies, self.impacts = url, currencies, impacts
        self.history_path, self.refresh_seconds = history_path, refresh_seconds
        self._last_fetch = float("-inf")
        self._fetched: list[Event] = []
        super().__init__(self._base_events(), minutes_before, minutes_after)

    def _base_events(self) -> list[Event]:
        today = datetime.now(timezone.utc).date()
        history = [e for e in load_events_csv(self.history_path) if e.country in self.currencies]
        return static_us_events(today - timedelta(days=7), today + timedelta(days=60)) + history

    def refresh(self, force: bool = False) -> None:
        if not force and time.monotonic() - self._last_fetch < self.refresh_seconds:
            return
        self._last_fetch = time.monotonic()
        try:
            self._fetched = fetch_forexfactory(self.url, self.currencies, self.impacts)
            save_events_csv(self.history_path, self._fetched)
            upcoming = [e for e in self._fetched if e.time >= pd.Timestamp.now(tz="UTC")]
            log.info("Wirtschaftskalender aktualisiert: %d wichtige Termine diese Woche, %d noch offen",
                     len(self._fetched), len(upcoming))
        except (requests.RequestException, ValueError) as exc:
            log.warning("Wirtschaftskalender nicht abrufbar (%s) – nutze gespeicherte Termine + NFP/FOMC-Regeln", exc)
        self.set_events(self._base_events() + self._fetched)

    def blocking_event(self, when) -> Event | None:
        self.refresh()
        return super().blocking_event(when)


def backtest_calendar(minutes_before: int, minutes_after: int, history_path: str | None = None,
                      currencies: set[str] | None = None) -> EventCalendar:
    """Für Backtests: eingebaute NFP/FOMC-Regeln + gesammelte echte Termine (falls vorhanden)."""
    history = load_events_csv(history_path) if history_path else []
    if currencies:
        history = [e for e in history if e.country in currencies]
    return EventCalendar(static_us_events() + history, minutes_before, minutes_after)
