"""Parameter-Suche mit ehrlicher Gegenprobe.

Die Daten werden geteilt: Auf den ersten 70 % wird der beste Parametersatz
gesucht ("Training"), auf den letzten 30 % wird geprüft, ob er auch auf
unbekannten Daten funktioniert ("Test"). Sieht der Test viel schlechter aus als
das Training, wurde die Strategie nur an die Vergangenheit angepasst
(Overfitting) und sollte NICHT live gehandelt werden.
"""

from __future__ import annotations

import itertools
from dataclasses import replace

import pandas as pd

from .backtest import BacktestConfig, run_backtest
from .strategy import StrategyParams

GRID = {
    "strategy": ["trend_pullback", "breakout", "session_breakout"],
    "adx_min": [15.0, 25.0],
    "atr_stop_mult": [1.5, 2.0, 2.5],
    # 0 = kein festes Ziel -> Gewinne laufen lassen (nur sinnvoll mit Trailing-Stop)
    "atr_target_mult": [2.0, 3.0, 0.0],
    "trailing_atr_mult": [0.0, 3.0],
}


def _score(stats: dict) -> float:
    """Rendite im Verhältnis zum Drawdown, mit Mindestanzahl an Trades."""
    if stats["Anzahl Trades"] < 15:
        return float("-inf")
    dd = abs(stats["Max. Drawdown %"]) or 1.0
    return stats["Rendite gesamt %"] / dd


def optimize(
    df: pd.DataFrame, base: StrategyParams, cfg: BacktestConfig, train_fraction: float = 0.7, grid: dict | None = None
) -> pd.DataFrame:
    grid = grid or GRID
    split = int(len(df) * train_fraction)
    # Testteil bekommt die Warmup-Kerzen aus dem Training mit, damit Indikatoren sofort gültig sind
    train = df.iloc[:split]
    test = df.iloc[max(0, split - base.warmup) :]

    rows = []
    keys = list(grid)
    for values in itertools.product(*(grid[k] for k in keys)):
        combo = dict(zip(keys, values))
        if combo.get("atr_target_mult") == 0 and combo.get("trailing_atr_mult", base.trailing_atr_mult) == 0:
            continue  # ohne Ziel UND ohne Trailing gäbe es nur Stop-Ausstiege
        if combo.get("strategy") == "session_breakout" and combo.get("adx_min", base.adx_min) != grid["adx_min"][0]:
            continue  # session_breakout nutzt keinen ADX -> nur einmal testen
        params = replace(base, **combo)
        tr = run_backtest(train, params, cfg).stats
        rows.append({**dict(zip(keys, values)), "score": _score(tr), "train": tr, "params": params})

    ranked = sorted(rows, key=lambda r: r["score"], reverse=True)[:5]
    out = []
    for r in ranked:
        te = run_backtest(test, r["params"], cfg).stats
        out.append(
            {
                **{k: r[k] for k in keys},
                "Train Rendite %": r["train"]["Rendite gesamt %"],
                "Train DD %": r["train"]["Max. Drawdown %"],
                "Train Trades": r["train"]["Anzahl Trades"],
                "Test Rendite %": te["Rendite gesamt %"],
                "Test DD %": te["Max. Drawdown %"],
                "Test Trades": te["Anzahl Trades"],
                "Test Profit-Faktor": te["Profit-Faktor"],
            }
        )
    return pd.DataFrame(out)
