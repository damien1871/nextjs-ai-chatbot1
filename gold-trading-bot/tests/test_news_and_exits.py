from datetime import date, datetime, timedelta, timezone
from dataclasses import replace

import pandas as pd
import pytest

from goldbot.backtest import BacktestConfig, run_backtest
from goldbot.news_calendar import (
    Event, EventCalendar, load_events_csv, parse_forexfactory, save_events_csv, static_us_events,
)
from goldbot.strategy import Signal, StrategyParams, add_indicators, signal_at, trailing_stop
from goldbot.trader import GoldTrader

from test_goldbot import FakeClient, _bars, _settings

UTC = timezone.utc


# ----------------------------------------------------------------- Kalender
def test_calendar_blocks_window_before_and_after():
    cal = EventCalendar([Event(pd.Timestamp("2026-03-06 13:30", tz="UTC"), "NFP")], 60, 30)
    assert cal.blocking_event(pd.Timestamp("2026-03-06 12:30", tz="UTC")) is not None
    assert cal.blocking_event(pd.Timestamp("2026-03-06 14:00", tz="UTC")) is not None
    assert cal.blocking_event(pd.Timestamp("2026-03-06 12:29", tz="UTC")) is None
    assert cal.blocking_event(pd.Timestamp("2026-03-06 14:01", tz="UTC")) is None


def test_static_events_respect_us_daylight_saving():
    events = {(e.time, e.title[:4]) for e in static_us_events(date(2026, 1, 1), date(2026, 7, 31))}
    times = {t for t, _ in events}
    assert pd.Timestamp("2026-01-02 13:30", tz="UTC") in times  # NFP Winterzeit
    assert pd.Timestamp("2026-07-03 12:30", tz="UTC") in times  # NFP Sommerzeit
    assert pd.Timestamp("2026-01-28 19:00", tz="UTC") in times  # FOMC Winterzeit
    assert pd.Timestamp("2026-06-17 18:00", tz="UTC") in times  # FOMC Sommerzeit


def test_parse_forexfactory_filters_currency_and_impact():
    items = [
        {"title": "Non-Farm Employment Change", "country": "USD", "date": "2026-11-06T08:30:00-05:00", "impact": "High"},
        {"title": "German ZEW", "country": "EUR", "date": "2026-11-03T05:00:00-05:00", "impact": "High"},
        {"title": "Crude Oil Inventories", "country": "USD", "date": "2026-11-04T10:30:00-05:00", "impact": "Medium"},
        {"title": "kaputt", "country": "USD", "date": "Tentative", "impact": "High"},
    ]
    events = parse_forexfactory(items, {"USD"}, {"High"})
    assert [e.title for e in events] == ["Non-Farm Employment Change"]
    assert events[0].time == pd.Timestamp("2026-11-06 13:30", tz="UTC")


def test_events_csv_roundtrip_merges(tmp_path):
    path = str(tmp_path / "ev.csv")
    a = Event(pd.Timestamp("2026-11-06 13:30", tz="UTC"), "NFP")
    b = Event(pd.Timestamp("2026-11-12 13:30", tz="UTC"), "CPI")
    save_events_csv(path, [a])
    save_events_csv(path, [a, b])
    assert load_events_csv(path) == [a, b]


def test_backtest_skips_entries_during_news(monkeypatch):
    times = pd.date_range("2026-03-06 10:00", periods=6, freq="h", tz="UTC")
    df = pd.DataFrame({"time": times, "open": 100.0, "high": 100.5, "low": 99.5, "close": 100.0,
                       "spread": 0.0, "volume": 0})
    monkeypatch.setattr("goldbot.backtest.signal_at",
                        lambda d, i, p: Signal("BUY", 5.0, 10.0, "t") if i == 2 else None)
    cal = EventCalendar([Event(pd.Timestamp("2026-03-06 13:30", tz="UTC"), "NFP")], 60, 30)
    res = run_backtest(df, StrategyParams(), BacktestConfig(calendar=cal))
    assert res.trades.empty
    assert res.stats["Wegen Terminen ausgelassen"] == 1
    res2 = run_backtest(df, StrategyParams(), BacktestConfig())
    assert len(res2.trades) == 1


# --------------------------------------------------------- Asien-Breakout
def _session_day(day: str, asian_high: float, asian_low: float, london_closes: list[float]) -> pd.DataFrame:
    rows = []
    start = pd.Timestamp(day, tz="UTC") - pd.Timedelta(hours=1)  # 23:00 Vortag
    mid = (asian_high + asian_low) / 2
    for k in range(8):  # 23:00 – 06:00
        rows.append((start + pd.Timedelta(hours=k), mid, asian_high, asian_low, mid))
    prev = mid
    for k, c in enumerate(london_closes):  # ab 07:00
        rows.append((start + pd.Timedelta(hours=8 + k), prev, max(prev, c) + 0.1, min(prev, c) - 0.1, c))
        prev = c
    return pd.DataFrame(rows, columns=["time", "open", "high", "low", "close"])


def test_session_breakout_first_break_only():
    p = StrategyParams(strategy="session_breakout", adr_days=2)
    days = [_session_day(f"2026-02-0{d}", 2010, 1990, [2000] * 15) for d in (2, 3)]
    # Tagesspanne vorher ca. 20 -> Range 6 ist eng genug (< 35 % von ~20 wäre 7)
    today = _session_day("2026-02-04", 2003, 1997, [2000, 2004, 2002, 2005, 2001])
    df = pd.concat(days + [today], ignore_index=True)
    df["spread"], df["volume"] = 0.0, 0
    p0 = replace(p, ema_slow=5, ema_fast=3, ema_pullback=2, adx_period=2, breakout_lookback=2)
    data = add_indicators(df, p0)
    sigs = {data["time"][i].hour: signal_at(data, i, p0) for i in range(len(data) - 5, len(data))}
    assert sigs[8] is not None and sigs[8].direction == "BUY"  # 08:00-Kerze schließt erstmals über 2003
    assert sigs[10] is None  # zweiter Ausbruch am selben Tag zählt nicht
    assert sigs[8].stop_distance >= 2004 - 1997 - 1e-9


# ------------------------------------------------------------ Trailing / Zeit
def test_trailing_stop_only_moves_in_profit_direction():
    assert trailing_stop("BUY", 2050, 5, 2000, 3) == 2035
    assert trailing_stop("BUY", 2010, 5, 2000, 3) == 2000
    assert trailing_stop("SELL", 1950, 5, 2000, 3) == 1965
    assert trailing_stop("SELL", 1999, 5, 1990, 3) == 1990


def test_backtest_trailing_and_time_exit(monkeypatch):
    times = pd.date_range("2026-01-05", periods=30, freq="h", tz="UTC")
    close = [100 + k for k in range(20)] + [119 - 3 * k for k in range(10)]
    df = pd.DataFrame({"time": times, "open": close, "high": [c + 0.5 for c in close],
                       "low": [c - 0.5 for c in close], "close": close, "spread": 0.0, "volume": 0})
    monkeypatch.setattr("goldbot.backtest.signal_at", lambda d, i, p: Signal("BUY", 5.0, 0.0, "t") if i == 0 else None)
    p = StrategyParams(trailing_atr_mult=3.0, atr_period=3)
    t = run_backtest(df, p, BacktestConfig(overnight_rate_annual=0)).trades
    assert len(t) == 1 and t.iloc[0]["exit_reason"].startswith("Stop")
    assert t.iloc[0]["pnl"] > 0  # Trailing hat Gewinn gesichert

    p2 = StrategyParams(max_hold_bars=4)
    t2 = run_backtest(df, p2, BacktestConfig(overnight_rate_annual=0)).trades
    assert t2.iloc[0]["exit_reason"] == "Zeitablauf"
    assert t2.iloc[0]["exit_time"] == times[4]


# ------------------------------------------------------------ Live-Trader
NOW = datetime(2026, 1, 1, tzinfo=UTC) + timedelta(hours=399, minutes=30)


class ManagingClient(FakeClient):
    def __init__(self, bars):
        super().__init__(bars)
        self.updates, self.closed = [], []

    def update_position(self, deal_id, stop_level, profit_level=None):
        self.updates.append((deal_id, stop_level, profit_level))

    def close_position(self, deal_id):
        self.closed.append(deal_id)


def _pos(opened: datetime, stop: float, direction="BUY"):
    return {"market": {"epic": "GOLD"}, "position": {
        "dealId": "D1", "direction": direction, "createdDateUTC": opened.strftime("%Y-%m-%dT%H:%M:%S.000"),
        "stopLevel": stop, "profitLevel": 2100.0, "upl": 0}}


def test_trader_trails_stop_and_keeps_target(tmp_path, monkeypatch):
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: None)
    client = ManagingClient(_bars())
    client.positions = [_pos(datetime(2026, 1, 16, tzinfo=UTC), 1900.0)]
    s = _settings(tmp_path)
    s.strategy = StrategyParams(trailing_atr_mult=3.0)
    t = GoldTrader(client, s)
    t.setup()
    t.tick(NOW)
    assert len(client.updates) == 1
    deal, new_stop, target = client.updates[0]
    assert deal == "D1" and new_stop > 1900.0 and target == 2100.0


def test_trader_time_exit(tmp_path, monkeypatch):
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: Signal("BUY", 20, 30, "t"))
    client = ManagingClient(_bars())
    client.positions = [_pos(datetime(2026, 1, 16, 8, tzinfo=UTC), 1900.0)]
    s = _settings(tmp_path)
    s.strategy = StrategyParams(max_hold_bars=5)
    monkeypatch.setattr("goldbot.trader.time.sleep", lambda x: None)
    t = GoldTrader(client, s)
    t.setup()
    t.tick(NOW)
    assert client.closed == ["D1"]
    assert len(client.orders) == 1  # danach ist wieder Platz für das neue Signal


def test_trader_skips_signal_during_news(tmp_path, monkeypatch):
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: Signal("BUY", 20, 30, "t"))
    client = FakeClient(_bars())
    cal = EventCalendar([Event(pd.Timestamp(NOW) + pd.Timedelta(minutes=20), "CPI")], 60, 30)
    t = GoldTrader(client, _settings(tmp_path), calendar=cal)
    t.setup()
    t.tick(NOW)
    assert client.orders == []
