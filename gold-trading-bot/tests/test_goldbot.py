from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

from goldbot import indicators as ind
from goldbot.backtest import BacktestConfig, run_backtest
from goldbot.capital_api import CapitalClient
from goldbot.config import Settings
from goldbot.data import prices_to_frame, synthetic_gold
from goldbot.risk import DailyLossGuard, position_size
from goldbot.strategy import Signal, StrategyParams
from goldbot.trader import GoldTrader


# ---------------------------------------------------------------- Indikatoren
def test_rsi_bounds_and_trend():
    up = pd.Series(np.arange(1, 100, dtype=float))
    assert ind.rsi(up).iloc[-1] == pytest.approx(100.0)
    noisy = pd.Series(np.random.default_rng(0).normal(0, 1, 500).cumsum() + 100)
    r = ind.rsi(noisy).dropna()
    assert r.between(0, 100).all()


def test_atr_constant_range():
    df = pd.DataFrame({"open": 10.0, "high": [11.0] * 50, "low": [9.0] * 50, "close": 10.0})
    assert ind.atr(df).iloc[-1] == pytest.approx(2.0)


# --------------------------------------------------------------------- Risiko
def test_position_size_risks_exact_fraction():
    # 10.000 Konto, 1 % = 100, Stop 20 $ -> 5 Unzen
    assert position_size(10_000, 0.01, 20, 0.01, 0.01) == pytest.approx(5.0)


def test_position_size_rounds_down_and_respects_minimum():
    assert position_size(10_000, 0.01, 30, 0.01, 0.01) == pytest.approx(3.33)
    # Konto zu klein -> lieber kein Trade als zu viel Risiko
    assert position_size(100, 0.01, 50, 1.0, 1.0) == 0.0


def test_position_size_currency_conversion():
    # EUR-Konto: 1 USD = 0,9 EUR -> Verlust pro Unze 18 EUR statt 20
    assert position_size(10_000, 0.01, 20, 0.01, 0.01, account_per_quote=0.9) == pytest.approx(5.55)


def test_daily_loss_guard_resets_each_day():
    g = DailyLossGuard(0.03)
    assert g.allows_trading(10_000, date(2026, 1, 5))
    assert g.allows_trading(9_800, date(2026, 1, 5))
    assert not g.allows_trading(9_650, date(2026, 1, 5))
    assert g.allows_trading(9_650, date(2026, 1, 6))


# ------------------------------------------------------------------- Backtest
def test_backtest_runs_and_is_consistent():
    df = synthetic_gold(3000)
    res = run_backtest(df, StrategyParams(), BacktestConfig())
    assert res.stats["Anzahl Trades"] > 10
    # Endkapital = Start + Summe aller Trade-Ergebnisse
    assert res.stats["Endkapital"] == pytest.approx(10_000 + res.trades["pnl"].sum(), abs=0.1)
    # Kein Trade darf vor dem Signal-Bar-Ende einsteigen: Einstieg nie auf der ersten Kerze
    assert (res.trades["entry_time"] > df["time"].iloc[0]).all()
    # Verluste über Stop sind auf ca. 1R begrenzt (Gaps ausgenommen)
    normal_stops = res.trades[res.trades["exit_reason"] == "Stop"]
    assert (normal_stops["r_multiple"] >= -1.05).all()


def test_backtest_no_lookahead():
    """Änderungen an zukünftigen Kerzen dürfen frühere Trades nicht beeinflussen."""
    df = synthetic_gold(3000)
    full = run_backtest(df, StrategyParams(), BacktestConfig(overnight_rate_annual=0)).trades
    cut = df["time"].iloc[2000]
    changed = df.copy()
    changed.loc[2001:, ["open", "high", "low", "close"]] *= 1.5
    other = run_backtest(changed, StrategyParams(), BacktestConfig(overnight_rate_annual=0)).trades
    a = full[full["exit_time"] < cut].reset_index(drop=True)
    b = other[other["exit_time"] < cut].reset_index(drop=True)
    pd.testing.assert_frame_equal(a, b)


def test_stop_wins_when_stop_and_target_in_same_bar(monkeypatch):
    times = pd.date_range("2026-01-01", periods=5, freq="h", tz="UTC")
    df = pd.DataFrame({"time": times, "open": 100.0, "high": 100.5, "low": 99.5, "close": 100.0,
                       "spread": 0.0, "volume": 0})
    df.loc[2, ["high", "low"]] = [120.0, 80.0]  # Riesenkerze trifft Stop und Ziel

    calls = {"n": 0}

    def fake_signal(data, i, p):
        if i == 0 and calls["n"] == 0:
            calls["n"] += 1
            return Signal("BUY", 5.0, 10.0, "test")
        return None

    monkeypatch.setattr("goldbot.backtest.signal_at", fake_signal)
    res = run_backtest(df, StrategyParams(), BacktestConfig(overnight_rate_annual=0))
    assert len(res.trades) == 1
    assert res.trades.iloc[0]["exit_reason"] == "Stop"
    assert res.trades.iloc[0]["r_multiple"] == pytest.approx(-1.0)


# ------------------------------------------------------------------- API-Daten
def _api_bar(t: datetime, price: float) -> dict:
    q = lambda x: {"bid": x - 0.15, "ask": x + 0.15}  # noqa: E731
    return {
        "snapshotTimeUTC": t.strftime("%Y-%m-%dT%H:%M:%S"),
        "openPrice": q(price), "closePrice": q(price + 0.5),
        "highPrice": q(price + 1), "lowPrice": q(price - 1), "lastTradedVolume": 10,
    }


def test_prices_to_frame_uses_mid_and_spread():
    df = prices_to_frame([_api_bar(datetime(2026, 1, 1, 10), 2000.0)])
    assert df.loc[0, "close"] == pytest.approx(2000.5)
    assert df.loc[0, "spread"] == pytest.approx(0.3)


# ------------------------------------------------------- Live-Trader (simuliert)
class FakeClient:
    environment = "demo"

    def __init__(self, bars):
        self.bars = bars
        self.orders = []
        self.positions = []

    def login(self):
        return {"currencyIsoCode": "USD"}

    def get_market(self, epic):
        return {"instrument": {"name": "Gold", "currency": "USD"},
                "dealingRules": {"minDealSize": {"value": 0.01}},
                "snapshot": {"marketStatus": "TRADEABLE", "bid": 2000.0, "offer": 2000.3}}

    def get_prices(self, epic, resolution, max_bars, start=None, end=None):
        return self.bars[-max_bars:]

    def get_positions(self):
        return self.positions

    def get_active_account(self):
        return {"balance": {"balance": 10_000.0}}

    def open_position(self, epic, direction, size, stop_level, profit_level):
        self.orders.append((direction, size, stop_level, profit_level))
        return "o_ref"

    def confirm(self, ref):
        return {"dealStatus": "ACCEPTED", "affectedDeals": [{"dealId": "D1"}]}


def _settings(tmp_path) -> Settings:
    return Settings(
        api_key="k", identifier="i", password="p", environment="demo", live_confirmed=False, epic="GOLD",
        resolution="HOUR", risk_per_trade=0.01, max_daily_loss=0.03, max_open_positions=1, size_step=0.01,
        price_decimals=2, poll_seconds=1, journal_path=str(tmp_path / "trades.csv"),
        log_path=str(tmp_path / "bot.log"), strategy=StrategyParams(),
    )


def _bars(n=400):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [_api_bar(start + timedelta(hours=k), 2000 + k * 0.1) for k in range(n)]


def test_trader_places_order_with_stop_and_target(tmp_path, monkeypatch):
    client = FakeClient(_bars())
    trader = GoldTrader(client, _settings(tmp_path))
    trader.setup()
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: Signal("BUY", 20.0, 30.0, "test"))
    monkeypatch.setattr("goldbot.trader.time.sleep", lambda s: None)
    now = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(hours=399, minutes=30)
    trader.tick(now)
    assert client.orders == [("BUY", 5.0, 1980.3, 2030.3)]
    assert "ACCEPTED" in (tmp_path / "trades.csv").read_text()
    # Gleiche Kerze nochmal -> keine zweite Order
    trader.tick(now)
    assert len(client.orders) == 1


def test_trader_respects_open_positions_and_dry_run(tmp_path, monkeypatch):
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: Signal("SELL", 20.0, 30.0, "test"))
    now = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(hours=399, minutes=30)

    client = FakeClient(_bars())
    client.positions = [{"market": {"epic": "GOLD"}, "position": {"upl": 1.0}}]
    t = GoldTrader(client, _settings(tmp_path))
    t.setup()
    t.tick(now)
    assert client.orders == []

    client2 = FakeClient(_bars())
    t2 = GoldTrader(client2, _settings(tmp_path), dry_run=True)
    t2.setup()
    t2.tick(now)
    assert client2.orders == []
    assert "NICHT GESENDET" in (tmp_path / "trades.csv").read_text()


def test_trader_drops_unfinished_candle(tmp_path, monkeypatch):
    seen = {}
    monkeypatch.setattr("goldbot.trader.latest_signal", lambda df, p: seen.setdefault("t", df["time"].iloc[-1]) and None)
    client = FakeClient(_bars())
    t = GoldTrader(client, _settings(tmp_path), dry_run=True)
    t.setup()
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    t.tick(start + timedelta(hours=399, minutes=30))  # letzte Kerze (399) läuft noch
    assert seen["t"] == pd.Timestamp(start + timedelta(hours=398))


# --------------------------------------------------------------- API-Client
class FakeResp:
    def __init__(self, status, body=None, headers=None):
        self.status_code, self._body, self.headers = status, body or {}, headers or {}
        self.content = b"x" if body is not None else b""
        self.text = str(body)

    def json(self):
        return self._body


class FakeHTTP:
    def __init__(self):
        self.calls = []
        self.expire_next = True

    def post(self, url, json, headers, timeout):
        self.calls.append(("POST", url))
        return FakeResp(200, {"currencyIsoCode": "USD"}, {"CST": "c", "X-SECURITY-TOKEN": "s"})

    def request(self, method, url, headers, timeout, **kw):
        self.calls.append((method, url))
        assert headers["CST"] == "c" and headers["X-SECURITY-TOKEN"] == "s"
        if self.expire_next:
            self.expire_next = False
            return FakeResp(401, {"errorCode": "error.invalid.session.token"})
        return FakeResp(200, {"positions": []})


def test_client_relogs_after_session_expiry(monkeypatch):
    monkeypatch.setattr("goldbot.capital_api.time.sleep", lambda s: None)
    http = FakeHTTP()
    c = CapitalClient("key", "me", "pw", "demo", session=http)
    assert c.get_positions() == []
    assert [m for m, _ in http.calls] == ["POST", "GET", "POST", "GET"]
    assert http.calls[0][1] == "https://demo-api-capital.backend-capital.com/api/v1/session"
