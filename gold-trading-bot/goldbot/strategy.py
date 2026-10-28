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
    strategy: str = "trend_pullback"  # "trend_pullback", "breakout" oder "session_breakout"
    ema_fast: int = 50
    ema_slow: int = 200
    ema_pullback: int = 20
    rsi_period: int = 14
    atr_period: int = 14
    adx_period: int = 14
    adx_min: float = 20.0
    breakout_lookback: int = 20
    atr_stop_mult: float = 2.0
    atr_target_mult: float = 3.0  # 0 = kein festes Gewinnziel (dann Trailing-Stop nutzen!)
    # Ausstieg
    trailing_atr_mult: float = 0.0  # >0: Stop zieht im Abstand von x ATR hinter dem besten Schlusskurs nach
    max_hold_bars: int = 0  # >0: Position nach x Kerzen schließen
    # Asien-Range-Breakout (alle Zeiten UTC)
    session_start_hour: int = 23
    session_end_hour: int = 7
    trade_until_hour: int = 12
    session_range_max: float = 0.35  # Range darf max. 35 % der durchschnittlichen Tagesspanne sein
    adr_days: int = 14

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
    target_distance: float  # 0 = kein Gewinnziel
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
    if "time" in out:
        _add_session_range(out, p)
    return out


def _add_session_range(out: pd.DataFrame, p: StrategyParams) -> None:
    """Asien-Range (Standard 23:00–07:00 UTC) und die durchschnittliche Tagesspanne."""
    t = pd.to_datetime(out["time"], utc=True)
    # Zeit so verschieben, dass der Handelstag um session_start_hour beginnt
    shifted = t + pd.Timedelta(hours=(24 - p.session_start_hour) % 24)
    day = shifted.dt.floor("D")
    asian_hours = (p.session_end_hour - p.session_start_hour) % 24
    in_asian = shifted.dt.hour < asian_hours

    asian_high = out["high"].where(in_asian).groupby(day).transform("max")
    asian_low = out["low"].where(in_asian).groupby(day).transform("min")
    asian_bars = in_asian.groupby(day).transform("sum")
    daily_range = out.groupby(day)["high"].max() - out.groupby(day)["low"].min()
    adr = daily_range.rolling(p.adr_days, min_periods=p.adr_days).mean().shift(1)

    # Nur nach Ende der Asien-Session, bis trade_until_hour (Kerzen-Eröffnungszeit, UTC)
    hour = t.dt.hour
    window = ~in_asian & (hour >= p.session_end_hour) & (hour < p.trade_until_hour) & (asian_bars >= 3)
    up = window & (out["close"] > asian_high)
    down = window & (out["close"] < asian_low)

    out["asian_high"] = asian_high
    out["asian_low"] = asian_low
    out["adr"] = day.map(adr).astype(float).values
    # Nur der ERSTE Ausbruch des Tages zählt
    out["first_break_up"] = up & (up.astype(int).groupby(day).cumsum() == 1)
    out["first_break_down"] = down & (down.astype(int).groupby(day).cumsum() == 1)


def _trend(row: pd.Series) -> int:
    """+1 Aufwärtstrend, -1 Abwärtstrend, 0 kein klarer Trend."""
    if row["close"] > row["ema_slow"] and row["ema_fast"] > row["ema_slow"]:
        return 1
    if row["close"] < row["ema_slow"] and row["ema_fast"] < row["ema_slow"]:
        return -1
    return 0


def _trend_pullback(row: pd.Series, prev: pd.Series, p: StrategyParams):
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


def _breakout(row: pd.Series, prev: pd.Series, p: StrategyParams):
    """Ausbruch über das Hoch/Tief der letzten n Kerzen in Trendrichtung."""
    trend = _trend(row)
    if row["adx"] < p.adx_min:
        return None
    if trend == 1 and row["close"] > row["donchian_high"] and prev["close"] <= prev["donchian_high"]:
        return "BUY", "Breakout long über %d-Kerzen-Hoch" % p.breakout_lookback
    if trend == -1 and row["close"] < row["donchian_low"] and prev["close"] >= prev["donchian_low"]:
        return "SELL", "Breakout short unter %d-Kerzen-Tief" % p.breakout_lookback
    return None


def _session_breakout(row: pd.Series, prev: pd.Series, p: StrategyParams):
    """Asien-Range-Breakout zur London-Eröffnung.

    Zwischen 23:00 und 07:00 UTC bildet Gold oft eine enge Spanne. Bricht der Kurs
    nach 07:00 UTC (London) erstmals per Schlusskurs aus dieser Spanne aus, wird in
    Ausbruchsrichtung gehandelt. Nur wenn die Spanne eng war (<= 35 % der
    durchschnittlichen Tagesspanne) – sonst ist die Energie meist schon verbraucht.
    Stop: andere Seite der Spanne (mind. 1 ATR). Ziel: gleiches Chance/Risiko wie
    bei den anderen Strategien (atr_target_mult / atr_stop_mult).
    """
    if "asian_high" not in row or pd.isna(row["asian_high"]) or pd.isna(row["adr"]):
        return None
    rng = row["asian_high"] - row["asian_low"]
    if rng <= 0 or rng > p.session_range_max * row["adr"]:
        return None
    rr = p.atr_target_mult / p.atr_stop_mult if p.atr_stop_mult else 0
    if row["first_break_up"]:
        stop = max(row["close"] - row["asian_low"], row["atr"])
        return "BUY", "Asien-Range-Breakout long (Range %.1f)" % rng, stop, stop * rr
    if row["first_break_down"]:
        stop = max(row["asian_high"] - row["close"], row["atr"])
        return "SELL", "Asien-Range-Breakout short (Range %.1f)" % rng, stop, stop * rr
    return None


STRATEGIES = {"trend_pullback": _trend_pullback, "breakout": _breakout, "session_breakout": _session_breakout}


def signal_at(df: pd.DataFrame, i: int, p: StrategyParams) -> Signal | None:
    """Signal für die (abgeschlossene) Kerze an Position i. df muss add_indicators() durchlaufen haben."""
    if p.strategy not in STRATEGIES:
        raise ValueError(f"Unbekannte Strategie {p.strategy!r}. Verfügbar: {', '.join(STRATEGIES)}")
    if i < max(1, p.warmup):
        return None
    row, prev = df.iloc[i], df.iloc[i - 1]
    needed = ["atr"] if p.strategy == "session_breakout" else ["ema_slow", "ema_fast", "ema_pullback", "rsi", "atr", "adx"]
    if row[needed].isna().any():
        return None
    result = STRATEGIES[p.strategy](row, prev, p)
    if result is None:
        return None
    if len(result) == 4:
        direction, reason, stop, target = result
    else:
        direction, reason = result
        stop, target = row["atr"] * p.atr_stop_mult, row["atr"] * p.atr_target_mult
    return Signal(direction=direction, stop_distance=float(stop), target_distance=float(target), reason=reason)


def latest_signal(df: pd.DataFrame, p: StrategyParams) -> Signal | None:
    """Signal für die letzte Kerze in df (die abgeschlossen sein muss)."""
    return signal_at(add_indicators(df, p), len(df) - 1, p)


def trailing_stop(direction: str, best_close: float, atr_value: float, current_stop: float, mult: float) -> float:
    """Neuer Stop beim Nachziehen – bewegt sich nur in Gewinnrichtung, nie zurück."""
    if mult <= 0 or pd.isna(atr_value):
        return current_stop
    if direction == "BUY":
        return max(current_stop, best_close - mult * atr_value)
    return min(current_stop, best_close + mult * atr_value)
