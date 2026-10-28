"""Kursdaten laden, umwandeln und speichern."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from .capital_api import CapitalClient

log = logging.getLogger(__name__)

RESOLUTION_MINUTES = {
    "MINUTE": 1,
    "MINUTE_5": 5,
    "MINUTE_15": 15,
    "MINUTE_30": 30,
    "HOUR": 60,
    "HOUR_4": 240,
    "DAY": 1440,
    "WEEK": 10080,
}

COLUMNS = ["time", "open", "high", "low", "close", "spread", "volume"]


def _mid(p: dict | None) -> float:
    if not p:
        return float("nan")
    bid, ask = p.get("bid"), p.get("ask")
    if bid is None or ask is None:
        return float(bid if bid is not None else ask if ask is not None else "nan")
    return (bid + ask) / 2


def prices_to_frame(prices: list[dict]) -> pd.DataFrame:
    """API-Kerzen (Bid/Ask) -> DataFrame mit Mittelkursen und Spread."""
    rows = []
    for p in prices:
        close = p.get("closePrice") or {}
        spread = (
            close["ask"] - close["bid"] if close.get("ask") is not None and close.get("bid") is not None else 0.0
        )
        rows.append(
            {
                "time": pd.Timestamp(p["snapshotTimeUTC"], tz="UTC"),
                "open": _mid(p.get("openPrice")),
                "high": _mid(p.get("highPrice")),
                "low": _mid(p.get("lowPrice")),
                "close": _mid(close),
                "spread": spread,
                "volume": p.get("lastTradedVolume", 0),
            }
        )
    if not rows:
        return pd.DataFrame(columns=COLUMNS)
    return pd.DataFrame(rows).drop_duplicates("time").sort_values("time").reset_index(drop=True)


def fetch_history(
    client: CapitalClient, epic: str, resolution: str, days: int, end: datetime | None = None
) -> pd.DataFrame:
    """Lädt `days` Tage Historie in Blöcken zu max. 1000 Kerzen."""
    minutes = RESOLUTION_MINUTES[resolution]
    end = end or datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    chunk = timedelta(minutes=minutes * 1000)
    frames = []
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + chunk, end)
        prices = client.get_prices(
            epic,
            resolution,
            1000,
            start=cursor.strftime("%Y-%m-%dT%H:%M:%S"),
            end=chunk_end.strftime("%Y-%m-%dT%H:%M:%S"),
        )
        frames.append(prices_to_frame(prices))
        log.info("  %s bis %s: %d Kerzen", cursor.date(), chunk_end.date(), len(prices))
        cursor = chunk_end
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=COLUMNS)
    return pd.concat(frames).drop_duplicates("time").sort_values("time").reset_index(drop=True)


def save_csv(df: pd.DataFrame, path: str) -> None:
    df.to_csv(path, index=False)


def load_csv(path: str) -> pd.DataFrame:
    """Lädt eine CSV mit mindestens den Spalten time, open, high, low, close."""
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    missing = {"time", "open", "high", "low", "close"} - set(df.columns)
    if missing:
        raise ValueError(f"CSV fehlen Spalten: {', '.join(sorted(missing))}")
    df["time"] = pd.to_datetime(df["time"], utc=True)
    if "spread" not in df:
        df["spread"] = np.nan
    if "volume" not in df:
        df["volume"] = 0
    return df[COLUMNS].sort_values("time").reset_index(drop=True)


def synthetic_gold(bars: int = 6000, seed: int = 7, start_price: float = 2000.0) -> pd.DataFrame:
    """Künstliche Gold-ähnliche Stundenkerzen – NUR zum Ausprobieren/Testen der Software.
    Ergebnisse darauf sagen nichts über den echten Markt aus."""
    rng = np.random.default_rng(seed)
    # Abwechselnde Trend-Regime + Rauschen
    drift = np.repeat(rng.normal(0, 0.0004, bars // 300 + 1), 300)[:bars]
    vol = np.repeat(rng.uniform(0.002, 0.006, bars // 500 + 1), 500)[:bars]
    rets = drift + rng.normal(0, 1, bars) * vol
    close = start_price * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[start_price], close[:-1]])
    wick = np.abs(rng.normal(0, 1, (2, bars))) * vol * close * 0.5
    high = np.maximum(open_, close) + wick[0]
    low = np.minimum(open_, close) - wick[1]
    times = pd.date_range("2022-01-03", periods=bars, freq="h", tz="UTC")
    return pd.DataFrame(
        {"time": times, "open": open_, "high": high, "low": low, "close": close, "spread": 0.3, "volume": 0}
    )
