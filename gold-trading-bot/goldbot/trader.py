"""Der eigentliche Bot: wartet auf jede neue abgeschlossene Kerze, prüft die
Strategie und eröffnet bei einem Signal eine Position mit Stop-Loss und
Take-Profit. Stop und Ziel liegen beim Broker – sie greifen also auch, wenn der
Bot oder dein Computer ausfällt."""

from __future__ import annotations

import csv
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import requests

from .capital_api import CapitalAPIError, CapitalClient
from .config import Settings
from .data import RESOLUTION_MINUTES, prices_to_frame
from .risk import DailyLossGuard, position_size
from .strategy import latest_signal

log = logging.getLogger(__name__)

JOURNAL_FIELDS = [
    "time_utc", "mode", "direction", "size", "entry_ref", "stop", "target", "deal_reference", "deal_id", "status", "reason",
]


class GoldTrader:
    def __init__(self, client: CapitalClient, settings: Settings, dry_run: bool = False):
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
        count = min(1000, self.p.warmup + 100)
        df = prices_to_frame(self.client.get_prices(self.s.epic, self.s.resolution, count))
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
        self._open(signal, equity)

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
        target = round(ref + sign * signal.target_distance, self.s.price_decimals)
        row = {
            "time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "mode": "dry-run" if self.dry_run else self.client.environment,
            "direction": signal.direction, "size": size, "entry_ref": ref, "stop": stop, "target": target,
            "deal_reference": "", "deal_id": "", "status": "", "reason": signal.reason,
        }
        if self.dry_run:
            row["status"] = "NICHT GESENDET"
            log.info("[DRY-RUN] würde %s %s x %s @ ~%.2f | SL %.2f | TP %.2f",
                     signal.direction, size, self.s.epic, ref, stop, target)
        else:
            ref_id = self.client.open_position(self.s.epic, signal.direction, size, stop, target)
            time.sleep(1)
            conf = self.client.confirm(ref_id)
            deals = conf.get("affectedDeals") or [{}]
            row.update(deal_reference=ref_id, deal_id=deals[0].get("dealId", conf.get("dealId", "")),
                       status=conf.get("dealStatus", "?"))
            log.info("ORDER %s %s x %s @ ~%.2f | SL %.2f | TP %.2f | Status %s (%s)",
                     signal.direction, size, self.s.epic, ref, stop, target, row["status"], conf.get("reason", ""))
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
