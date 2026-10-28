"""Backtest: Wie hätte die Strategie in der Vergangenheit abgeschnitten?

Regeln, damit das Ergebnis nicht geschönt ist:
- Signal auf Kerze i -> Einstieg erst zum Eröffnungskurs von Kerze i+1.
- Spread wird bei jedem Einstieg und Ausstieg bezahlt.
- Werden Stop UND Ziel in derselben Kerze berührt, zählt der Stop (pessimistisch).
- Öffnet der Markt mit einer Lücke hinter dem Stop, wird zum schlechteren Kurs ausgestiegen.
- Übernachtgebühren für CFDs werden grob berücksichtigt.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .risk import DailyLossGuard, position_size
from .strategy import StrategyParams, add_indicators, signal_at


@dataclass
class BacktestConfig:
    initial_equity: float = 10_000.0
    risk_per_trade: float = 0.01
    max_daily_loss: float = 0.03
    default_spread: float = 0.35  # in $, falls die Daten keinen Spread enthalten
    min_size: float = 0.01
    size_step: float = 0.01
    overnight_rate_annual: float = 0.03  # grobe Schätzung der CFD-Finanzierungskosten


@dataclass
class BacktestResult:
    trades: pd.DataFrame
    equity: pd.Series
    stats: dict = field(default_factory=dict)


def run_backtest(df: pd.DataFrame, p: StrategyParams, cfg: BacktestConfig | None = None) -> BacktestResult:
    cfg = cfg or BacktestConfig()
    data = add_indicators(df.reset_index(drop=True), p)
    spread = data["spread"].fillna(cfg.default_spread).to_numpy()
    o, h, l, c = (data[k].to_numpy() for k in ("open", "high", "low", "close"))
    times = data["time"]

    equity = cfg.initial_equity
    guard = DailyLossGuard(cfg.max_daily_loss)
    pos: dict | None = None
    pending = None
    trades: list[dict] = []
    curve = np.empty(len(data))

    for i in range(len(data)):
        half = spread[i] / 2

        # 1) Ausstehendes Signal zur Eröffnung dieser Kerze ausführen
        if pending is not None and pos is None:
            sig = pending
            entry = o[i] + half if sig.direction == "BUY" else o[i] - half
            size = position_size(equity, cfg.risk_per_trade, sig.stop_distance, cfg.min_size, cfg.size_step)
            if size > 0:
                sign = 1 if sig.direction == "BUY" else -1
                pos = {
                    "direction": sig.direction,
                    "sign": sign,
                    "entry_time": times[i],
                    "entry": entry,
                    "size": size,
                    "stop": entry - sign * sig.stop_distance,
                    "target": entry + sign * sig.target_distance,
                    "risk": sig.stop_distance * size,
                    "reason": sig.reason,
                }
        pending = None

        # 2) Stop / Ziel prüfen (Long schließt zum Bid, Short zum Ask)
        if pos is not None:
            s = pos["sign"]
            exit_open, exit_low, exit_high = o[i] - s * half, l[i] - s * half, h[i] - s * half
            exit_price = None
            if s == 1:
                if exit_open <= pos["stop"]:
                    exit_price, why = exit_open, "Stop (Gap)"
                elif exit_low <= pos["stop"]:
                    exit_price, why = pos["stop"], "Stop"
                elif exit_high >= pos["target"]:
                    exit_price, why = pos["target"], "Ziel"
            else:
                if exit_open >= pos["stop"]:
                    exit_price, why = exit_open, "Stop (Gap)"
                elif exit_high >= pos["stop"]:
                    exit_price, why = pos["stop"], "Stop"
                elif exit_low <= pos["target"]:
                    exit_price, why = pos["target"], "Ziel"
            if exit_price is None and i == len(data) - 1:
                exit_price, why = c[i] - s * half, "Ende Backtest"
            if exit_price is not None:
                equity += _close_trade(pos, exit_price, times[i], why, cfg, trades)
                pos = None

        # 3) Kontostand inkl. offener Position
        unrealized = 0.0 if pos is None else (c[i] - pos["sign"] * half - pos["entry"]) * pos["sign"] * pos["size"]
        curve[i] = equity + unrealized

        # 4) Neues Signal auf dieser (jetzt abgeschlossenen) Kerze?
        if pos is None and guard.allows_trading(curve[i], times[i].date()):
            pending = signal_at(data, i, p)

    trades_df = pd.DataFrame(trades)
    equity_series = pd.Series(curve, index=times, name="equity")
    return BacktestResult(trades_df, equity_series, compute_stats(trades_df, equity_series, data, cfg))


def _close_trade(pos: dict, exit_price: float, when, why: str, cfg: BacktestConfig, trades: list) -> float:
    gross = (exit_price - pos["entry"]) * pos["sign"] * pos["size"]
    days = max((when - pos["entry_time"]).total_seconds() / 86400, 0)
    financing = pos["entry"] * pos["size"] * cfg.overnight_rate_annual * int(days) / 365
    pnl = gross - financing
    trades.append(
        {
            "entry_time": pos["entry_time"],
            "exit_time": when,
            "direction": pos["direction"],
            "size": pos["size"],
            "entry": round(pos["entry"], 3),
            "exit": round(exit_price, 3),
            "stop": round(pos["stop"], 3),
            "target": round(pos["target"], 3),
            "pnl": round(pnl, 2),
            "r_multiple": round(pnl / pos["risk"], 2) if pos["risk"] else 0.0,
            "exit_reason": why,
            "entry_reason": pos["reason"],
        }
    )
    return pnl


def compute_stats(trades: pd.DataFrame, equity: pd.Series, data: pd.DataFrame, cfg: BacktestConfig) -> dict:
    start, end = cfg.initial_equity, float(equity.iloc[-1]) if len(equity) else cfg.initial_equity
    peak = equity.cummax()
    max_dd = float(((equity - peak) / peak).min()) if len(equity) else 0.0
    daily = equity.resample("1D").last().dropna().pct_change().dropna()
    sharpe = float(daily.mean() / daily.std() * np.sqrt(252)) if len(daily) > 1 and daily.std() > 0 else 0.0
    n = len(trades)
    wins = trades[trades["pnl"] > 0] if n else trades
    losses = trades[trades["pnl"] <= 0] if n else trades
    gross_win = float(wins["pnl"].sum()) if n else 0.0
    gross_loss = float(-losses["pnl"].sum()) if n else 0.0
    years = (data["time"].iloc[-1] - data["time"].iloc[0]).days / 365.25 if len(data) > 1 else 0
    total = end / start - 1
    return {
        "Zeitraum": f"{data['time'].iloc[0]:%Y-%m-%d} bis {data['time'].iloc[-1]:%Y-%m-%d}" if len(data) else "-",
        "Startkapital": round(start, 2),
        "Endkapital": round(end, 2),
        "Rendite gesamt %": round(total * 100, 2),
        "Rendite pro Jahr %": round(((1 + total) ** (1 / years) - 1) * 100, 2) if years > 0 and end > 0 else 0.0,
        "Max. Drawdown %": round(max_dd * 100, 2),
        "Sharpe Ratio": round(sharpe, 2),
        "Anzahl Trades": n,
        "Trefferquote %": round(len(wins) / n * 100, 1) if n else 0.0,
        "Profit-Faktor": round(gross_win / gross_loss, 2) if gross_loss > 0 else float("inf") if gross_win > 0 else 0.0,
        "Ø R pro Trade": round(float(trades["r_multiple"].mean()), 2) if n else 0.0,
        "Buy & Hold Gold %": round((data["close"].iloc[-1] / data["close"].iloc[0] - 1) * 100, 2) if len(data) else 0.0,
    }


def format_stats(stats: dict) -> str:
    width = max(len(k) for k in stats)
    return "\n".join(f"  {k:<{width}} : {v}" for k, v in stats.items())
