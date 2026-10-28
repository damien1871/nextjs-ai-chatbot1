#!/usr/bin/env python3
"""Gold-Trading-Bot – Kommandozeile.

  python bot.py check                      Verbindung + Kontostand + Goldkurs prüfen
  python bot.py download --days 730        Historische Kurse als CSV speichern
  python bot.py backtest --data data/gold_HOUR.csv
  python bot.py optimize --data data/gold_HOUR.csv
  python bot.py run --dry-run              Live mitlaufen, aber keine Orders senden
  python bot.py run                        Bot handeln lassen (Demo, solange .env nichts anderes sagt)
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import replace

import pandas as pd

from goldbot.backtest import BacktestConfig, format_stats, run_backtest
from goldbot.capital_api import CapitalAPIError, CapitalClient
from goldbot.config import Settings
from goldbot.data import fetch_history, load_csv, save_csv, synthetic_gold
from goldbot.optimize import optimize
from goldbot.trader import GoldTrader

log = logging.getLogger("goldbot")


def setup_logging(log_path: str | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_path:
        os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
        handlers.append(logging.FileHandler(log_path, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", handlers=handlers)


def make_client(s: Settings) -> CapitalClient:
    s.require_credentials()
    return CapitalClient(s.api_key, s.identifier, s.password, s.environment)


def load_data(args, s: Settings) -> pd.DataFrame:
    if args.synthetic:
        log.warning("Verwende KÜNSTLICHE Testdaten – nur um die Software auszuprobieren!")
        return synthetic_gold()
    if args.data:
        return load_csv(args.data)
    log.info("Lade %d Tage %s-Kerzen von Capital.com ...", args.days, s.resolution)
    return fetch_history(make_client(s), s.epic, s.resolution, args.days)


def cmd_check(args, s: Settings) -> None:
    client = make_client(s)
    info = client.login()
    acc = client.get_active_account()
    bal = acc.get("balance", {})
    print(f"\n✔ Verbunden mit Capital.com ({s.environment.upper()})")
    print(f"  Konto: {acc.get('accountName')} | Kontostand {bal.get('balance')} {info.get('currencyIsoCode')}"
          f" | verfügbar {bal.get('available')}")
    try:
        m = client.get_market(s.epic)
    except CapitalAPIError as exc:
        print(f"✘ Markt '{s.epic}' nicht gefunden ({exc}). Treffer für 'gold':")
        for mk in client.search_markets("gold")[:10]:
            print(f"    EPIC={mk.get('epic'):<12} {mk.get('instrumentName')}")
        return
    snap, instr, rules = m.get("snapshot", {}), m.get("instrument", {}), m.get("dealingRules", {})
    print(f"  Markt: {instr.get('name')} (EPIC {s.epic}) | Status {snap.get('marketStatus')}")
    print(f"  Kurs: Bid {snap.get('bid')} / Ask {snap.get('offer')} {instr.get('currency')}")
    print(f"  Mindestgröße: {rules.get('minDealSize', {}).get('value')} | Hebel/Margin: {instr.get('marginFactor')}"
          f" {instr.get('marginFactorUnit', '')}")
    bars = client.get_prices(s.epic, s.resolution, 5)
    print(f"  Letzte {len(bars)} {s.resolution}-Kerzen geladen ✔\n")


def cmd_download(args, s: Settings) -> None:
    client = make_client(s)
    df = fetch_history(client, s.epic, s.resolution, args.days)
    out = args.out or f"data/{s.epic.lower()}_{s.resolution}.csv"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    save_csv(df, out)
    if df.empty:
        print("Keine Daten erhalten.")
    else:
        print(f"✔ {len(df)} Kerzen ({df['time'].iloc[0]:%Y-%m-%d} bis {df['time'].iloc[-1]:%Y-%m-%d}) -> {out}")


def _bt_config(args, s: Settings) -> BacktestConfig:
    return BacktestConfig(initial_equity=args.equity, risk_per_trade=s.risk_per_trade, max_daily_loss=s.max_daily_loss)


def _params(args, s: Settings):
    return replace(s.strategy, strategy=args.strategy) if args.strategy else s.strategy


def cmd_backtest(args, s: Settings) -> None:
    df = load_data(args, s)
    params = _params(args, s)
    res = run_backtest(df, params, _bt_config(args, s))
    os.makedirs("results", exist_ok=True)
    res.trades.to_csv("results/trades.csv", index=False)
    res.equity.to_csv("results/equity.csv")
    print(f"\nBacktest – Strategie '{params.strategy}', {len(df)} Kerzen")
    print(format_stats(res.stats))
    print("\nEinzelne Trades: results/trades.csv | Kontoverlauf: results/equity.csv")
    if args.plot:
        _plot(res.equity)


def _plot(equity: pd.Series) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("Für --plot bitte installieren: pip install matplotlib")
        return
    ax = equity.plot(figsize=(11, 5), title="Kontoverlauf im Backtest")
    ax.set_ylabel("Kontostand")
    plt.tight_layout()
    plt.savefig("results/equity.png", dpi=120)
    print("Grafik: results/equity.png")


def cmd_optimize(args, s: Settings) -> None:
    df = load_data(args, s)
    print(f"Teste {len(df)} Kerzen – das dauert ein paar Minuten ...")
    table = optimize(df, s.strategy, _bt_config(args, s))
    with pd.option_context("display.width", 200, "display.max_columns", 20):
        print("\nTop 5 Parameter (gefunden auf den ersten 70 %, geprüft auf den letzten 30 % der Daten):\n")
        print(table.to_string(index=False))
    print(
        "\nSo liest du das: Wichtig sind die 'Test'-Spalten. Nimm nur Einstellungen, die auch im Test"
        "\npositiv sind und einen erträglichen Drawdown haben. Übernimm sie in deine .env"
        "\n(STRATEGY, ADX_MIN, ATR_STOP_MULT, ATR_TARGET_MULT)."
    )


def cmd_run(args, s: Settings) -> None:
    client = make_client(s)
    if s.environment == "live" and not args.dry_run:
        log.warning("!!! LIVE-MODUS: Der Bot handelt mit ECHTEM GELD !!!")
    GoldTrader(client, s, dry_run=args.dry_run).run_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gold-Trading-Bot für Capital.com")
    parser.add_argument("--env-file", default=".env", help="Pfad zur .env-Datei")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="Verbindung und Konto prüfen")

    p = sub.add_parser("download", help="Historische Kurse speichern")
    p.add_argument("--days", type=int, default=730)
    p.add_argument("--out")

    for name, helptext in (("backtest", "Strategie an Vergangenheitsdaten testen"),
                           ("optimize", "Parameter suchen und gegenprüfen")):
        p = sub.add_parser(name, help=helptext)
        src = p.add_mutually_exclusive_group()
        src.add_argument("--data", help="CSV-Datei (aus 'download')")
        src.add_argument("--synthetic", action="store_true", help="Künstliche Testdaten (ohne Konto)")
        p.add_argument("--days", type=int, default=730, help="Tage direkt von der API laden (wenn kein --data)")
        p.add_argument("--equity", type=float, default=10_000.0, help="Startkapital für den Backtest")
        if name == "backtest":
            p.add_argument("--strategy", choices=["trend_pullback", "breakout"])
            p.add_argument("--plot", action="store_true", help="Kontoverlauf als PNG speichern")

    p = sub.add_parser("run", help="Bot starten")
    p.add_argument("--dry-run", action="store_true", help="Nur Signale loggen, keine Orders senden")

    args = parser.parse_args()
    s = Settings.load(args.env_file)
    setup_logging(s.log_path if args.cmd == "run" else None)
    try:
        {"check": cmd_check, "download": cmd_download, "backtest": cmd_backtest,
         "optimize": cmd_optimize, "run": cmd_run}[args.cmd](args, s)
    except CapitalAPIError as exc:
        log.error("Capital.com meldet einen Fehler: %s", exc)
        if exc.status in (400, 401):
            log.error("Tipp: API-Key, E-Mail und API-Passwort in .env prüfen und ob der Key für %s erstellt wurde.",
                      s.environment.upper())
        sys.exit(1)


if __name__ == "__main__":
    main()
