"""Der eigentliche Bot: wartet auf jede neue abgeschlossene Kerze, prüft die
Strategie und eröffnet bei einem Signal eine Position mit Stop-Loss und
Take-Profit. Stop und Ziel liegen beim Broker – sie greifen also auch, wenn der
Bot oder dein Computer ausfällt.

Zusätzlich: keine neuen Trades rund um wichtige US-Termine (Wirtschaftskalender),
optional nachziehender Stop (Trailing) und Ausstieg nach x Kerzen."""

from __future__ import annotations

import csv
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import pandas as pd
import requests

from . import indicators as ind
from .capital_api import CapitalAPIError, CapitalClient
from .config import Settings
from .data import RESOLUTION_MINUTES, prices_to_frame
from .news_calendar import EventCalendar, LiveNewsCalendar
from .risk import DailyLossGuard, position_size
from .strategy import latest_signal, trailing_stop

log = logging.getLogger(__name__)

JOURNAL_FIELDS = [
    "time_utc", "mode", "direction", "size", "entry_ref", "stop", "target", "deal_reference", "deal_id", "status", "reason",
]


class GoldTrader:
    def __init__(
        self, client: CapitalClient, settings: Settings, dry_run: bool = False, calendar: EventCalendar | None = None
    ):
        self.client = client
        self.s = settings
        self.p = settings.strategy
        self.dry_run = dry_run
        self.guard = DailyLossGuard(settings.max_daily_loss)
        self.bar = timedelta(minutes=RESOLUTION_MINUTES[settings.resolution])
        self.last_bar = None
        self.min_size = settings.size_step
        self.account_ccy = "USD"
        self.quote_ccy = "USD"
        if calendar is None and settings.news_filter:
            calendar = LiveNewsCalendar(
                settings.news_minutes_before, settings.news_minutes_after, set(settings.news_currencies),
                set(settings.news_impacts), history_path=settings.news_history_path,
            )
        self.calendar = calendar

    # ----------------------------------------------------------------- Setup
    def setup(self) -> None:
        info = self.client.login()
        self.account_ccy = info.get("currencyIsoCode", "USD")
        market = self.client.get_market(self.s.epic)
        instr = market.get("instrument", {})
        self.quote_ccy = instr.get("currency", "USD")
        rules = market.get("dealingRules", {})
        self.min_size = float(rules.get("minDealSize", {}).get("value", self.s.size_step))
        log.info(
            "Markt %s (%s) | Kontowährung %s | Mindestgröße %s | Strategie %s | Zeiteinheit %s | Risiko/Trade %.2f %% | %s",
            self.s.epic, instr.get("name", "?"), self.account_ccy, self.min_size, self.p.strategy,
            self.s.resolution, self.s.risk_per_trade * 100, "DRY-RUN (keine Orders)" if self.dry_run else "ORDERS AKTIV",
        )

    def account_per_quote(self) -> float:
        """Wie viel Kontowährung ist 1 Einheit der Kurswährung (USD) wert?"""
        if self.account_ccy == self.quote_ccy:
            return 1.0
        for epic, invert in ((f"{self.account_ccy}{self.quote_ccy}", True), (f"{self.quote_ccy}{self.account_ccy}", False)):
            try:
                snap = self.client.get_market(epic).get("snapshot", {})
                mid = (snap["bid"] + snap["offer"]) / 2
                return 1 / mid if invert else mid
            except (CapitalAPIError, KeyError, TypeError, ZeroDivisionError):
                continue
        log.warning("Wechselkurs %s/%s nicht gefunden – rechne mit 1:1", self.quote_ccy, self.account_ccy)
        return 1.0

    # ------------------------------------------------------------------ Logik
    def tick(self, now: datetime | None = None) -> None:
        now = now or datetime.now(timezone.utc)
        df = prices_to_frame(self.client.get_prices(self.s.epic, self.s.resolution, 1000))
        # Die letzte Kerze ist meist noch nicht fertig -> verwerfen
        if len(df) and df["time"].iloc[-1] + self.bar > now:
            df = df.iloc[:-1]
        if df.empty:
            log.warning("Keine Kursdaten erhalten")
            return
        bar_time = df["time"].iloc[-1]
        if bar_time == self.last_bar:
            return
        self._on_new_bar(df, now)
        # Erst nach erfolgreicher Verarbeitung merken -> bei Fehlern wird die Kerze erneut geprüft
        self.last_bar = bar_time

    def _on_new_bar(self, df, now: datetime) -> None:
        bar_time = df["time"].iloc[-1]
        if len(df) < self.p.warmup:
            log.warning("Nur %d Kerzen – brauche mind. %d für die Indikatoren", len(df), self.p.warmup)
            return

        signal = latest_signal(df, self.p)
        log.info("Neue Kerze %s | Schluss %.2f | Signal: %s", bar_time, df["close"].iloc[-1],
                 f"{signal.direction} ({signal.reason})" if signal else "keins")

        positions = [p for p in self.client.get_positions() if p.get("market", {}).get("epic") == self.s.epic]
        positions = self._manage_positions(df, positions)
        account = self.client.get_active_account()
        equity = float(account["balance"]["balance"])
        allowed = self.guard.allows_trading(equity, now.date())
        upl = sum(float(p["position"].get("upl", 0)) for p in positions)
        log.info("Konto: %.2f %s | offene %s-Positionen: %d (unrealisiert %.2f)",
                 equity, self.account_ccy, self.s.epic, len(positions), upl)

        if signal is None:
            return
        if len(positions) >= self.s.max_open_positions:
            log.info("Signal ignoriert: bereits %d Position(en) offen", len(positions))
            return
        if not allowed:
            log.warning("Signal ignoriert: Tagesverlust-Limit (%.1f %%) erreicht – Pause bis morgen (UTC)",
                        self.s.max_daily_loss * 100)
            return
        event = self.calendar.blocking_event(now) if self.calendar else None
        if event is not None:
            log.warning("Signal ignoriert: wichtiger Termin '%s' (%s) um %s UTC – Sperrfenster %d min davor / %d min danach",
                        event.title, event.country, f"{event.time:%d.%m. %H:%M}",
                        self.s.news_minutes_before, self.s.news_minutes_after)
            return
        self._open(signal, equity)

    def _manage_positions(self, df: pd.DataFrame, positions: list[dict]) -> list[dict]:
        """Zeit-Ausstieg und Trailing-Stop für offene Positionen. Gibt die noch offenen zurück."""
        if not (self.p.max_hold_bars or self.p.trailing_atr_mult > 0) or not positions:
            return positions
        last_close_time = df["time"].iloc[-1] + self.bar
        atr_now = float(ind.atr(df, self.p.atr_period).iloc[-1])
        remaining = []
        for item in positions:
            pos = item["position"]
            deal_id, direction = pos["dealId"], pos["direction"]
            opened = pd.Timestamp(pos["createdDateUTC"])
            opened = opened.tz_localize("UTC") if opened.tzinfo is None else opened.tz_convert("UTC")
            bars_held = int((last_close_time - opened) / self.bar)

            if self.p.max_hold_bars and bars_held >= self.p.max_hold_bars:
                log.info("Zeitablauf: Position %s ist %d Kerzen offen -> schließen%s",
                         deal_id, bars_held, " [DRY-RUN]" if self.dry_run else "")
                if not self.dry_run:
                    self.client.close_position(deal_id)
                continue

            current = pos.get("stopLevel")
            if self.p.trailing_atr_mult > 0 and current is not None:
                closes = df.loc[df["time"] >= opened.floor(self.bar), "close"]
                if len(closes):
                    best = closes.max() if direction == "BUY" else closes.min()
                    new = round(trailing_stop(direction, best, atr_now, float(current), self.p.trailing_atr_mult),
                                self.s.price_decimals)
                    if abs(new - float(current)) >= 10 ** -self.s.price_decimals:
                        log.info("Trailing-Stop %s: %.2f -> %.2f%s", deal_id, float(current), new,
                                 " [DRY-RUN]" if self.dry_run else "")
                        if not self.dry_run:
                            self.client.update_position(deal_id, new, pos.get("profitLevel"))
            remaining.append(item)
        return remaining

    def _open(self, signal, equity: float) -> None:
        snap = self.client.get_market(self.s.epic).get("snapshot", {})
        if snap.get("marketStatus") != "TRADEABLE":
            log.info("Signal ignoriert: Markt ist %s", snap.get("marketStatus"))
            return
        size = position_size(
            equity, self.s.risk_per_trade, signal.stop_distance, self.min_size, self.s.size_step,
            account_per_quote=self.account_per_quote(),
        )
        if size <= 0:
            log.warning("Signal ignoriert: Konto zu klein für Mindestgröße %s bei Stop-Abstand %.2f",
                        self.min_size, signal.stop_distance)
            return
        sign = 1 if signal.direction == "BUY" else -1
        ref = float(snap["offer"] if sign == 1 else snap["bid"])
        stop = round(ref - sign * signal.stop_distance, self.s.price_decimals)
        target = (
            round(ref + sign * signal.target_distance, self.s.price_decimals) if signal.target_distance > 0 else None
        )
        row = {
            "time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "mode": "dry-run" if self.dry_run else self.client.environment,
            "direction": signal.direction, "size": size, "entry_ref": ref, "stop": stop, "target": target,
            "deal_reference": "", "deal_id": "", "status": "", "reason": signal.reason,
        }
        if self.dry_run:
            row["status"] = "NICHT GESENDET"
            log.info("[DRY-RUN] würde %s %s x %s @ ~%.2f | SL %.2f | TP %s",
                     signal.direction, size, self.s.epic, ref, stop, target or "keins")
        else:
            ref_id = self.client.open_position(self.s.epic, signal.direction, size, stop, target)
            time.sleep(1)
            conf = self.client.confirm(ref_id)
            deals = conf.get("affectedDeals") or [{}]
            row.update(deal_reference=ref_id, deal_id=deals[0].get("dealId", conf.get("dealId", "")),
                       status=conf.get("dealStatus", "?"))
            log.info("ORDER %s %s x %s @ ~%.2f | SL %.2f | TP %s | Status %s (%s)",
                     signal.direction, size, self.s.epic, ref, stop, target or "keins", row["status"],
                     conf.get("reason", ""))
        self._journal(row)

    def _journal(self, row: dict) -> None:
        path = self.s.journal_path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        new = not os.path.exists(path)
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=JOURNAL_FIELDS)
            if new:
                w.writeheader()
            w.writerow(row)

    # ---------------------------------------------------------------- Schleife
    def run_forever(self) -> None:
        self.setup()
        if self.calendar is not None:
            log.info("Wirtschaftskalender-Filter AN: keine neuen Trades %d min vor bis %d min nach %s-Terminen (%s)",
                     self.s.news_minutes_before, self.s.news_minutes_after,
                     "/".join(sorted(self.s.news_impacts)), ", ".join(sorted(self.s.news_currencies)))
        else:
            log.info("Wirtschaftskalender-Filter AUS")
        log.info("Bot läuft. Prüfe alle %d Sekunden auf neue Kerzen. Beenden mit Strg+C.", self.s.poll_seconds)
        failures = 0
        while True:
            try:
                self.tick()
                failures = 0
                time.sleep(self.s.poll_seconds)
            except KeyboardInterrupt:
                log.info("Bot beendet. Offene Positionen bleiben mit Stop-Loss/Take-Profit beim Broker bestehen.")
                return
            except (CapitalAPIError, requests.RequestException, KeyError, ValueError) as exc:
                failures += 1
                wait = min(300, 10 * 2 ** min(failures, 5))
                log.error("Fehler (%d. in Folge): %s – neuer Versuch in %d s", failures, exc, wait)
                try:
                    time.sleep(wait)
                except KeyboardInterrupt:
                    log.info("Bot beendet.")
                    return
