"""Handelsstrategien für Gold.

Jede Strategie schaut NUR auf abgeschlossene Kerzen und liefert entweder
kein Signal oder ein Signal mit Richtung, Stop-Abstand und Gewinnziel-Abstand.
Stop und Ziel werden aus der aktuellen Volatilität (ATR) berechnet, damit sie
sich automatisch an ruhige und hektische Marktphasen anpassen.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields

import pandas as pd

from . import indicators as ind


@dataclass
class StrategyParams:
    strategy: str = "trend_pullback"  # oder "breakout"
    ema_fast: int = 50
    ema_slow: int = 200
    ema_pullback: int = 20
    rsi_period: int = 14
    atr_period: int = 14
    adx_period: int = 14
    adx_min: float = 20.0
    breakout_lookback: int = 20
    atr_stop_mult: float = 2.0
    atr_target_mult: float = 3.0

    @property
    def warmup(self) -> int:
        """Anzahl Kerzen, bevor die Indikatoren verlässlich sind."""
        return max(self.ema_slow, self.breakout_lookback, self.adx_period * 3) + 5

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "StrategyParams":
        names = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in data.items() if k in names})


@dataclass
class Signal:
    direction: str  # "BUY" oder "SELL"
    stop_distance: float
    target_distance: float
    reason: str


def add_indicators(df: pd.DataFrame, p: StrategyParams) -> pd.DataFrame:
    out = df.copy()
    out["ema_fast"] = ind.ema(out["close"], p.ema_fast)
    out["ema_slow"] = ind.ema(out["close"], p.ema_slow)
    out["ema_pullback"] = ind.ema(out["close"], p.ema_pullback)
    out["rsi"] = ind.rsi(out["close"], p.rsi_period)
    out["atr"] = ind.atr(out, p.atr_period)
    out["adx"] = ind.adx(out, p.adx_period)
    # Höchstes Hoch / tiefstes Tief der VORHERIGEN n Kerzen (ohne die aktuelle)
    out["donchian_high"] = out["high"].rolling(p.breakout_lookback).max().shift(1)
    out["donchian_low"] = out["low"].rolling(p.breakout_lookback).min().shift(1)
    return out


def _trend(row: pd.Series) -> int:
    """+1 Aufwärtstrend, -1 Abwärtstrend, 0 kein klarer Trend."""
    if row["close"] > row["ema_slow"] and row["ema_fast"] > row["ema_slow"]:
        return 1
    if row["close"] < row["ema_slow"] and row["ema_fast"] < row["ema_slow"]:
        return -1
    return 0


def _trend_pullback(row: pd.Series, prev: pd.Series, p: StrategyParams) -> tuple[str, str] | None:
    """Im Trend auf einen Rücksetzer zur EMA20 warten und mit dem Trend einsteigen.

    Long: Aufwärtstrend + ADX stark genug + Kerze berührt EMA20 von oben,
    schließt aber wieder darüber und grün + RSI 40-70 (nicht überkauft).
    Short: spiegelbildlich.
    """
    trend = _trend(row)
    if row["adx"] < p.adx_min:
        return None
    if (
        trend == 1
        and row["low"] <= row["ema_pullback"] < row["close"]
        and row["close"] > row["open"]
        and 40 <= row["rsi"] <= 70
    ):
        return "BUY", "Trend-Pullback long: Rücksetzer an EMA%d im Aufwärtstrend" % p.ema_pullback
    if (
        trend == -1
        and row["high"] >= row["ema_pullback"] > row["close"]
        and row["close"] < row["open"]
        and 30 <= row["rsi"] <= 60
    ):
        return "SELL", "Trend-Pullback short: Rücksetzer an EMA%d im Abwärtstrend" % p.ema_pullback
    return None


def _breakout(row: pd.Series, prev: pd.Series, p: StrategyParams) -> tuple[str, str] | None:
    """Ausbruch über das Hoch/Tief der letzten n Kerzen in Trendrichtung."""
    trend = _trend(row)
    if row["adx"] < p.adx_min:
        return None
    if trend == 1 and row["close"] > row["donchian_high"] and prev["close"] <= prev["donchian_high"]:
        return "BUY", "Breakout long über %d-Kerzen-Hoch" % p.breakout_lookback
    if trend == -1 and row["close"] < row["donchian_low"] and prev["close"] >= prev["donchian_low"]:
        return "SELL", "Breakout short unter %d-Kerzen-Tief" % p.breakout_lookback
    return None


STRATEGIES = {"trend_pullback": _trend_pullback, "breakout": _breakout}


def signal_at(df: pd.DataFrame, i: int, p: StrategyParams) -> Signal | None:
    """Signal für die (abgeschlossene) Kerze an Position i. df muss add_indicators() durchlaufen haben."""
    if p.strategy not in STRATEGIES:
        raise ValueError(f"Unbekannte Strategie {p.strategy!r}. Verfügbar: {', '.join(STRATEGIES)}")
    if i < max(1, p.warmup):
        return None
    row, prev = df.iloc[i], df.iloc[i - 1]
    if row[["ema_slow", "ema_fast", "ema_pullback", "rsi", "atr", "adx"]].isna().any():
        return None
    result = STRATEGIES[p.strategy](row, prev, p)
    if result is None:
        return None
    direction, reason = result
    return Signal(
        direction=direction,
        stop_distance=float(row["atr"] * p.atr_stop_mult),
        target_distance=float(row["atr"] * p.atr_target_mult),
        reason=reason,
    )


def latest_signal(df: pd.DataFrame, p: StrategyParams) -> Signal | None:
    """Signal für die letzte Kerze in df (die abgeschlossen sein muss)."""
    return signal_at(add_indicators(df, p), len(df) - 1, p)
