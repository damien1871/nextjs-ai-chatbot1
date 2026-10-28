"""Einstellungen aus der Datei .env bzw. aus Umgebungsvariablen."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

from .strategy import StrategyParams


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _split(value: str, norm) -> list[str]:
    return [norm(v.strip()) for v in value.split(",") if v.strip()]


@dataclass
class Settings:
    api_key: str
    identifier: str
    password: str
    environment: str
    live_confirmed: bool
    epic: str
    resolution: str
    risk_per_trade: float
    max_daily_loss: float
    max_open_positions: int
    size_step: float
    price_decimals: int
    poll_seconds: int
    journal_path: str
    log_path: str
    strategy: StrategyParams
    news_filter: bool = True
    news_minutes_before: int = 60
    news_minutes_after: int = 30
    news_currencies: frozenset = frozenset({"USD"})
    news_impacts: frozenset = frozenset({"High"})
    news_history_path: str = "data/calendar_events.csv"

    @classmethod
    def load(cls, env_file: str = ".env") -> "Settings":
        load_dotenv(env_file)
        s = cls(
            api_key=_get("CAPITAL_API_KEY"),
            identifier=_get("CAPITAL_IDENTIFIER"),
            password=_get("CAPITAL_PASSWORD"),
            environment=_get("CAPITAL_ENVIRONMENT", "demo").lower(),
            live_confirmed=_get("I_UNDERSTAND_LIVE_TRADING_RISK").upper() == "YES",
            epic=_get("EPIC", "GOLD"),
            resolution=_get("RESOLUTION", "HOUR").upper(),
            risk_per_trade=float(_get("RISK_PER_TRADE", "0.01")),
            max_daily_loss=float(_get("MAX_DAILY_LOSS", "0.03")),
            max_open_positions=int(_get("MAX_OPEN_POSITIONS", "1")),
            size_step=float(_get("SIZE_STEP", "0.01")),
            price_decimals=int(_get("PRICE_DECIMALS", "2")),
            poll_seconds=int(_get("POLL_SECONDS", "30")),
            journal_path=_get("JOURNAL_PATH", "logs/trades.csv"),
            log_path=_get("LOG_PATH", "logs/bot.log"),
            strategy=StrategyParams(
                strategy=_get("STRATEGY", "trend_pullback"),
                adx_min=float(_get("ADX_MIN", "20")),
                atr_stop_mult=float(_get("ATR_STOP_MULT", "2.0")),
                atr_target_mult=float(_get("ATR_TARGET_MULT", "3.0")),
                trailing_atr_mult=float(_get("TRAILING_ATR_MULT", "0")),
                max_hold_bars=int(_get("MAX_HOLD_BARS", "0")),
                session_range_max=float(_get("SESSION_RANGE_MAX", "0.35")),
            ),
            news_filter=_get("NEWS_FILTER", "ON").upper() in ("ON", "YES", "TRUE", "1"),
            news_minutes_before=int(_get("NEWS_MINUTES_BEFORE", "60")),
            news_minutes_after=int(_get("NEWS_MINUTES_AFTER", "30")),
            news_currencies=frozenset(_split(_get("NEWS_CURRENCIES", "USD"), str.upper)),
            news_impacts=frozenset(_split(_get("NEWS_IMPACT", "High"), str.capitalize)),
        )
        s.validate()
        return s

    def validate(self) -> None:
        if self.environment not in ("demo", "live"):
            raise ValueError("CAPITAL_ENVIRONMENT muss 'demo' oder 'live' sein")
        if not 0 < self.risk_per_trade <= 0.05:
            raise ValueError("RISK_PER_TRADE muss zwischen 0 und 0.05 (5 %) liegen – empfohlen: 0.005 bis 0.01")
        if not 0 < self.max_daily_loss <= 0.2:
            raise ValueError("MAX_DAILY_LOSS muss zwischen 0 und 0.2 liegen")

    def require_credentials(self) -> None:
        missing = [
            n
            for n, v in (
                ("CAPITAL_API_KEY", self.api_key),
                ("CAPITAL_IDENTIFIER", self.identifier),
                ("CAPITAL_PASSWORD", self.password),
            )
            if not v
        ]
        if missing:
            raise SystemExit(f"Fehlende Zugangsdaten in .env: {', '.join(missing)} (siehe README, Schritt 3)")
        if self.environment == "live" and not self.live_confirmed:
            raise SystemExit(
                "LIVE-Modus ist gesperrt. Setze I_UNDERSTAND_LIVE_TRADING_RISK=YES in .env, "
                "wenn du wirklich mit echtem Geld handeln willst."
            )
