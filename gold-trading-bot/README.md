# 🥇 Gold-Trading-Bot (Capital.com)

Ein automatischer Handelsbot für **Gold (XAU/USD)**. Er analysiert den Goldkurs jede Stunde, kauft oder verkauft
selbstständig und setzt dabei **immer einen Stop-Loss und ein Gewinnziel direkt beim Broker**.

> ⚠️ **Bitte zuerst lesen:** Es gibt keinen „perfekten“ Trading-Algorithmus. Auch dieser Bot wird Verlusttrades
> und Verlustphasen haben. Gold wird hier über **CFDs mit Hebel** gehandelt, und laut den Pflichthinweisen der
> Broker verliert die Mehrheit der Privatkunden mit CFDs Geld. Der Bot läuft deshalb standardmäßig im
> **Demokonto mit Spielgeld**. Für echtes Geld muss der Live-Modus extra freigeschaltet werden.
> Setze nie Geld ein, dessen Verlust du dir nicht leisten kannst. Das hier ist keine Anlageberatung.

---

## Inhalt

1. [Welcher Broker und warum](#1-welcher-broker-und-warum)
2. [Wie der Bot handelt](#2-wie-der-bot-handelt)
3. [Schritt-für-Schritt-Anleitung](#3-schritt-für-schritt-anleitung)
4. [Den Bot rund um die Uhr laufen lassen](#4-den-bot-rund-um-die-uhr-laufen-lassen)
5. [Später auf echtes Geld umstellen (optional)](#5-später-auf-echtes-geld-umstellen-optional)
6. [Alle Einstellungen](#6-alle-einstellungen)
7. [Fehlerbehebung](#7-fehlerbehebung)
8. [Dateien im Projekt](#8-dateien-im-projekt)

---

## 1. Welcher Broker und warum

| Broker | Kostenlose Demo | API für Bots | Gold | Für dich geeignet? |
|---|---|---|---|---|
| **Capital.com** ✅ | Ja, unbegrenzt, mit Spielgeld | Offizielle REST-API, **funktioniert auch im Demokonto** | Ja (`GOLD`) | **Ja – gewählt.** Läuft auf Windows, Mac, Linux und Raspberry Pi, kein Zusatzprogramm nötig. In der EU reguliert (CySEC/Zypern). |
| MetaTrader-5-Broker (z. B. IC Markets, Pepperstone, FXFlat) | Ja | Python-Paket `MetaTrader5` | Ja | Möglich, aber das MT5-Programm muss dauerhaft offen sein und das Python-Paket läuft nur unter Windows. |
| OANDA | Ja | Sehr gute v20-API | Ja | Laut OANDA-Doku gibt es die v20-API nicht für Kunden von OANDA TMS (EU). Für Deutschland daher schwierig. |
| Interactive Brokers | Ja (Paper Trading) | Ja, aber kompliziert (TWS/Gateway) | Ja | Eher für Fortgeschrittene, aufwendige Kontoeröffnung. |

**Wahl: Capital.com.** Dort bekommst du ein kostenloses Demokonto mit Spielgeld, die offizielle API funktioniert
auch im Demokonto, und der Bot braucht nur Python.

Gut zu wissen über Capital.com:
- Du handelst **CFDs**: Du besitzt kein echtes Gold, sondern wettest auf den Kurs. Geht es nach oben **oder** unten, kannst du verdienen.
- Für Positionen, die über Nacht offen bleiben, fallen **Übernachtgebühren** an. Der Backtest rechnet sie grob mit ein.
- Kosten entstehen vor allem über den **Spread** (Differenz zwischen Kauf- und Verkaufskurs).
- Bitte prüfe bei der Kontoeröffnung selbst, ob Capital.com für deinen Wohnsitz verfügbar ist und welche Gesellschaft dein Konto führt.

---

## 2. Wie der Bot handelt

Der Bot kennt zwei Strategien. Beide handeln **nur in Trendrichtung** und nur, wenn der Trend stark genug ist (ADX).

**Strategie A – `trend_pullback` (Standard)**
1. **Trend bestimmen:** Kurs über der 200er-EMA und 50er-EMA über 200er-EMA → Aufwärtstrend (umgekehrt: Abwärtstrend).
2. **Trendstärke:** ADX ≥ 20. Bei Seitwärtsmarkt wird nicht gehandelt.
3. **Rücksetzer abwarten:** Der Kurs fällt kurz bis an die 20er-EMA zurück, die Kerze schließt aber wieder darüber und grün.
4. **Nicht überhitzt:** RSI zwischen 40 und 70.
5. → **Kaufen.** Für Verkaufen (Short) gelten die Regeln spiegelbildlich.

**Strategie B – `breakout`**
Im Trend kauft der Bot, wenn der Kurs über das Hoch der letzten 20 Kerzen ausbricht (Short: unter das Tief).

**Stop-Loss und Gewinnziel** richten sich nach der aktuellen Schwankungsbreite (ATR):
- Stop-Loss = 2 × ATR vom Einstieg entfernt
- Gewinnziel = 3 × ATR → jeder Gewinner bringt etwa 1,5-mal so viel, wie ein Verlierer kostet.

**Risikomanagement (das Wichtigste):**
- **Positionsgröße automatisch:** Jeder Trade riskiert genau **1 % des Kontos** (einstellbar). Bei 10.000 € heißt das: Wird der Stop getroffen, verlierst du ca. 100 €.
- **Tageslimit:** Nach **3 % Verlust an einem Tag** macht der Bot bis zum nächsten Tag keine neuen Trades.
- **Maximal 1 Position** gleichzeitig.
- Stop und Ziel liegen **beim Broker** und greifen deshalb auch, wenn dein PC abstürzt oder das Internet weg ist.
- Signale werden nur auf **abgeschlossenen Kerzen** berechnet, nie auf einer halb fertigen Kerze.

---

## 3. Schritt-für-Schritt-Anleitung

### Schritt 1 – Python installieren

**Windows**
1. Öffne https://www.python.org/downloads/ und lade die aktuelle Version herunter (3.10 oder neuer).
2. Setze beim Installieren **unbedingt den Haken bei „Add Python to PATH“**.
3. Öffne danach die **Eingabeaufforderung** (Windows-Taste → `cmd` eintippen → Enter) und prüfe:
   ```
   python --version
   ```

**Mac**
1. Öffne das **Terminal** (Cmd+Leertaste → „Terminal“).
2. Gib `python3 --version` ein. Falls Python fehlt, installiere es von https://www.python.org/downloads/.

> Unter Mac/Linux heißt der Befehl `python3` statt `python`. In dieser Anleitung steht immer `python`.

### Schritt 2 – Den Bot herunterladen

Wähle eine der zwei Möglichkeiten:
- **Ohne Git:** Öffne https://github.com/damien1871/nextjs-ai-chatbot1, wähle oben links den Branch `claude/elegant-lamport-oeeb3f` (oder `main`, falls der Bot dort schon übernommen wurde). Klicke auf **Code → Download ZIP**, entpacke die Datei und öffne den Ordner `gold-trading-bot`.
- **Mit Git:**
  ```
  git clone -b claude/elegant-lamport-oeeb3f https://github.com/damien1871/nextjs-ai-chatbot1.git
  cd nextjs-ai-chatbot1/gold-trading-bot
  ```

Wechsle dann im Terminal oder in der Eingabeaufforderung in den Ordner, zum Beispiel:
```
cd C:\Users\DEINNAME\Downloads\nextjs-ai-chatbot1\gold-trading-bot
```

Installiere die benötigten Pakete. Die „virtuelle Umgebung“ hält die Pakete sauber getrennt vom Rest deines Systems:

**Windows**
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
**Mac / Linux**
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
Vorne in der Zeile steht jetzt `(.venv)`. Wenn du später ein neues Terminal öffnest, musst du nur die
`activate`-Zeile erneut ausführen.

**Kurztest ohne Konto** (mit künstlichen Daten, nur um zu sehen, ob alles läuft):
```
python bot.py backtest --synthetic
```
Erscheint eine Tabelle mit Ergebnissen, ist die Installation in Ordnung. Die Zahlen sagen hier **nichts** über
den echten Goldmarkt aus.

### Schritt 3 – Kostenloses Demokonto und API-Schlüssel bei Capital.com

1. Registriere dich auf **https://capital.com** (E-Mail und Passwort genügen für das Demokonto).
2. Melde dich an und wechsle oben auf **„Demo“**. Dort hast du Spielgeld.
3. **Schalte die Zwei-Faktor-Authentifizierung (2FA) ein:** *Einstellungen → Sicherheit*. Ohne 2FA lässt sich kein API-Schlüssel erstellen.
4. Erstelle den API-Schlüssel: *Einstellungen → API-Integrationen → „Neuen Schlüssel generieren“*.
   - Gib dem Schlüssel einen Namen, zum Beispiel `goldbot`.
   - Vergib ein **eigenes Passwort für den Schlüssel** und merke es dir. Dieses Passwort kommt in die `.env`.
   - Kopiere den angezeigten **API-Key** sofort. Er wird oft nur einmal angezeigt.
   - Falls gefragt wird, ob der Schlüssel für Demo oder Live gilt: wähle **Demo**.

   *(Die Menünamen können sich bei Capital.com leicht ändern. Suche im Zweifel in den Einstellungen nach „API“.)*

### Schritt 4 – Zugangsdaten eintragen

1. Kopiere die Datei `.env.example` und nenne die Kopie **`.env`**:
   - Windows: `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
2. Öffne `.env` mit einem Texteditor (z. B. Notepad, TextEdit oder VS Code) und trage ein:
   ```
   CAPITAL_API_KEY=der_kopierte_api_key
   CAPITAL_IDENTIFIER=deine_login_email@beispiel.de
   CAPITAL_PASSWORD=das_passwort_des_api_schluessels
   CAPITAL_ENVIRONMENT=demo
   ```
3. Speichern. **Gib die `.env` niemals weiter und lade sie nirgends hoch.** Sie ist bereits in `.gitignore` eingetragen.

### Schritt 5 – Verbindung testen

```
python bot.py check
```
Die Ausgabe sieht ungefähr so aus:
```
✔ Verbunden mit Capital.com (DEMO)
  Konto: ... | Kontostand 10000.0 EUR | verfügbar 10000.0
  Markt: Gold (EPIC GOLD) | Status TRADEABLE
  Kurs: Bid 2650.12 / Ask 2650.42 USD
  ...
```
Wird der Markt `GOLD` nicht gefunden, zeigt der Bot alle Gold-Märkte mit ihrem EPIC-Kürzel an. Trage das passende
Kürzel dann in `.env` bei `EPIC=` ein.

### Schritt 6 – Backtest mit echten Golddaten (Pflicht vor dem Start!)

Lade zuerst die Kurse der letzten 2 Jahre herunter:
```
python bot.py download --days 730
```
Teste dann die Strategie:
```
python bot.py backtest --data data/gold_HOUR.csv
python bot.py backtest --data data/gold_HOUR.csv --strategy breakout
```
So liest du das Ergebnis:

| Kennzahl | Bedeutung | Gut, wenn … |
|---|---|---|
| Rendite gesamt % | Gewinn/Verlust über den ganzen Zeitraum | positiv |
| Max. Drawdown % | größter Rückgang vom Höchststand | besser als −20 % |
| Profit-Faktor | Summe Gewinne ÷ Summe Verluste | über 1,3 |
| Trefferquote % | Anteil der Gewinntrades | bei 1,5:1 Chance/Risiko reichen ca. 40 % |
| Anzahl Trades | Stichprobengröße | mind. 50, sonst ist das Ergebnis Zufall |
| Buy & Hold Gold % | Vergleich: Gold einfach gekauft und gehalten | – |

Alle Einzeltrades stehen in `results/trades.csv` (lässt sich in Excel öffnen). Mit `--plot` (vorher
`pip install matplotlib`) wird zusätzlich eine Grafik des Kontoverlaufs gespeichert.

### Schritt 7 – Optional: Einstellungen optimieren (ohne sich selbst zu belügen)

```
python bot.py optimize --data data/gold_HOUR.csv
```
Der Bot sucht auf den **ersten 70 %** der Daten die besten Einstellungen. Anschließend prüft er sie auf den
**letzten 30 %**, die er beim Suchen nicht gesehen hat. Entscheidend sind die **Test-Spalten**:
- Sind sie auch positiv → kann man die Einstellung in die `.env` übernehmen (`STRATEGY`, `ADX_MIN`, `ATR_STOP_MULT`, `ATR_TARGET_MULT`).
- Ist der Test deutlich schlechter als das Training → die Einstellung passt nur zufällig auf die Vergangenheit (**Overfitting**). Nicht verwenden.

### Schritt 8 – Probelauf ohne Orders

```
python bot.py run --dry-run
```
Der Bot läuft jetzt live mit. Er zeigt jede Stunde, was er tun **würde**, schickt aber keine Orders. Lass ihn
einen Tag so laufen. Alles wird zusätzlich in `logs/bot.log` gespeichert.

### Schritt 9 – Den Bot im Demokonto handeln lassen 🚀

```
python bot.py run
```
Jetzt handelt der Bot selbstständig mit Spielgeld. Das siehst du dabei:
- Im Fenster und in `logs/bot.log` stehen alle Entscheidungen und Kontostände.
- In `logs/trades.csv` steht jede Order (Richtung, Größe, Stop, Ziel, Status).
- In der Capital.com-App oder auf der Webseite (Demo) siehst du die Positionen live.

Beenden mit **Strg+C**. Offene Positionen bleiben mit Stop-Loss und Gewinnziel beim Broker bestehen.

**Empfehlung:** Lass den Bot **mindestens 2–3 Monate im Demokonto** laufen und vergleiche das Ergebnis mit dem
Backtest. Erst dann entscheiden.

---

## 4. Den Bot rund um die Uhr laufen lassen

Der Bot muss laufen, damit er neue Trades eröffnen kann. Die Stops liegen ohnehin beim Broker.

- **Eigener PC (Windows):** Stelle den Energiesparmodus auf „Nie“ (*Einstellungen → System → Netzbetrieb*) und lass das Fenster offen.
- **Raspberry Pi oder Linux-Server (stromsparend, empfohlen):**
  ```
  nohup python3 bot.py run > /dev/null 2>&1 &
  ```
  Logs findest du in `logs/bot.log`. Beenden mit `pkill -f "bot.py run"`.
- **Günstiger Cloud-Server (VPS, ca. 4–6 €/Monat, z. B. Hetzner):** Schritte 2, 4 und 5 dort ausführen und den Bot wie oben mit `nohup` oder `screen` starten.

---

## 5. Später auf echtes Geld umstellen (optional)

Stell erst um, wenn **alle** Punkte erfüllt sind:
- [ ] Backtest über mindestens 2 Jahre ist positiv, Drawdown ist für dich erträglich
- [ ] Mindestens 2–3 Monate Demo-Betrieb laufen ungefähr wie der Backtest
- [ ] Du verstehst, warum der Bot jeden Trade gemacht hat (`logs/bot.log`)
- [ ] Du setzt nur Geld ein, dessen kompletten Verlust du verkraften kannst
- [ ] `RISK_PER_TRADE` ist auf höchstens `0.005` (0,5 %) gesetzt, für den Anfang

Dann:
1. Bei Capital.com auf **Live** wechseln, Konto verifizieren und einzahlen. Einen **neuen API-Schlüssel für das Live-Konto** erstellen.
2. In `.env`:
   ```
   CAPITAL_API_KEY=live_api_key
   CAPITAL_PASSWORD=passwort_des_live_schluessels
   CAPITAL_ENVIRONMENT=live
   I_UNDERSTAND_LIVE_TRADING_RISK=YES
   ```
3. `python bot.py check`, dann `python bot.py run`.

**Steuern (Deutschland):** Gewinne aus CFDs sind Kapitalerträge. Ausländische Broker führen meist keine Steuer
ab, dann musst du die Gewinne selbst in der Steuererklärung (Anlage KAP) angeben. Frag im Zweifel einen
Steuerberater.

---

## 6. Alle Einstellungen

Alle Einstellungen stehen in der Datei `.env`:

| Einstellung | Standard | Bedeutung |
|---|---|---|
| `CAPITAL_ENVIRONMENT` | `demo` | `demo` = Spielgeld, `live` = echtes Geld |
| `I_UNDERSTAND_LIVE_TRADING_RISK` | `NO` | Muss `YES` sein, damit Live-Handel möglich ist |
| `EPIC` | `GOLD` | Markt-Kürzel bei Capital.com |
| `RESOLUTION` | `HOUR` | Kerzengröße: `MINUTE_15`, `MINUTE_30`, `HOUR`, `HOUR_4`, `DAY` |
| `STRATEGY` | `trend_pullback` | oder `breakout` |
| `ADX_MIN` | `20` | Mindest-Trendstärke. Höher = weniger, aber sauberere Trades |
| `ATR_STOP_MULT` | `2.0` | Stop-Abstand in ATR |
| `ATR_TARGET_MULT` | `3.0` | Ziel-Abstand in ATR |
| `RISK_PER_TRADE` | `0.01` | Risiko je Trade (0.01 = 1 %), maximal 0.05 erlaubt |
| `MAX_DAILY_LOSS` | `0.03` | Tagesverlust-Bremse (0.03 = 3 %) |
| `MAX_OPEN_POSITIONS` | `1` | Wie viele Gold-Positionen gleichzeitig |
| `SIZE_STEP` | `0.01` | Schrittweite der Positionsgröße |
| `PRICE_DECIMALS` | `2` | Nachkommastellen für Stop und Ziel |
| `POLL_SECONDS` | `30` | Wie oft der Bot nach einer neuen Kerze schaut |

Wenn du `RESOLUTION` änderst, lade die Daten neu herunter (`download`) und mach einen neuen Backtest.

---

## 7. Fehlerbehebung

| Problem | Lösung |
|---|---|
| `python` wird nicht gefunden | Unter Windows Python neu installieren und „Add to PATH“ anhaken. Unter Mac `python3` verwenden. |
| `No module named ...` | Virtuelle Umgebung aktivieren (`activate`-Zeile aus Schritt 2), dann `pip install -r requirements.txt` |
| `Fehlende Zugangsdaten in .env` | Heißt die Datei wirklich `.env`, nicht `.env.txt`? (Windows blendet Endungen aus.) Liegt sie im Ordner `gold-trading-bot`? |
| `HTTP 401` / `HTTP 400` beim Login | API-Key, Login-E-Mail oder **API-Schlüssel-Passwort** falsch, oder der Demo-Key wird mit `live` benutzt (bzw. umgekehrt) |
| `HTTP 429` | Zu viele Anfragen. Der Bot wartet automatisch und versucht es erneut. |
| `Konto zu klein für Mindestgröße` | Das Konto ist zu klein, um bei 1 % Risiko die Mindestgröße zu handeln. Der Bot lässt den Trade dann absichtlich aus. |
| Bot macht tagelang keinen Trade | Normal. Der Bot handelt nur bei klaren Signalen (im Backtest siehst du, wie oft das vorkommt). Am Wochenende ist der Goldmarkt geschlossen. |
| `Markt ist CLOSED` | Gold handelt etwa So 23 Uhr bis Fr 22 Uhr (UTC) mit einer täglichen kurzen Pause |

---

## 8. Dateien im Projekt

```
gold-trading-bot/
├── bot.py                 ← Startpunkt (alle Befehle)
├── .env.example           ← Vorlage für deine Einstellungen
├── requirements.txt       ← benötigte Python-Pakete
├── goldbot/
│   ├── capital_api.py     ← Verbindung zu Capital.com (Login, Kurse, Orders)
│   ├── indicators.py      ← EMA, RSI, ATR, ADX
│   ├── strategy.py        ← Die Handelsregeln
│   ├── risk.py            ← Positionsgröße + Tagesverlust-Bremse
│   ├── backtest.py        ← Test auf historischen Daten
│   ├── optimize.py        ← Parameter-Suche mit Gegenprobe
│   ├── data.py            ← Kursdaten laden/speichern
│   ├── config.py          ← liest die .env
│   └── trader.py          ← der Live-Bot
└── tests/                 ← automatische Tests (pip install pytest, dann: python -m pytest)
```

---

**Haftungsausschluss:** Diese Software ist ein Werkzeug, keine Gewinngarantie und keine Anlageberatung.
Vergangene Ergebnisse (Backtests) garantieren keine zukünftigen Gewinne. Die Nutzung erfolgt auf eigenes Risiko.
