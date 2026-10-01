# E-Rechnung aus PDF

Ein kleiner Betrieb lädt eine normale PDF-Rechnung hoch, zum Beispiel aus Word erstellt. Die App

1. liest mit KI (Claude) alle Rechnungsdaten aus,
2. zeigt sie in einem Formular zur Kontrolle an, und du kannst alles korrigieren,
3. prüft Summen und Pflichtangaben und zeigt verständliche Warnungen,
4. erzeugt eine **E-Rechnung im Format ZUGFeRD 2 (Profil EN 16931)**.

Das Ergebnis ist ein PDF, das genauso aussieht wie das Original. Zusätzlich enthält es die Rechnungsdaten als XML (PDF/A-3).

> Status: **Prototyp**. Es gibt noch kein Login, keine Bezahlung und keine Datenbank. Hochgeladene Dateien werden nicht gespeichert.

---

## 1. Einmalig einrichten (Windows)

1. **Python installieren:** Öffne https://www.python.org/downloads/ und klicke auf den großen gelben Knopf „Download Python“.
   Setze beim Installieren unbedingt das Häkchen bei **„Add python.exe to PATH“**, dann „Install Now“.
2. **Projekt herunterladen:** Öffne auf GitHub dieses Projekt und klicke auf den grünen Knopf **„Code“**, dann auf **„Download ZIP“**.
   Wähle vorher oben links den Branch `claude/app-development-founder-v1dwj6`, solange er noch nicht in `main` übernommen ist.
3. **Entpacken:** Rechtsklick auf die ZIP-Datei, dann „Alle extrahieren…“.
4. **Starten:** Doppelklick auf **`start.bat`** im entpackten Ordner.
   - Beim ersten Start richtet sich alles selbst ein. Das dauert 1–2 Minuten.
   - Danach öffnet sich der Browser mit der App unter http://127.0.0.1:8000.
   - Falls Windows „Der Computer wurde durch Windows geschützt“ meldet: Klicke auf „Weitere Informationen“ und dann auf „Trotzdem ausführen“.
5. **Beenden:** Schließ einfach das schwarze Fenster.

Mac/Linux: statt `start.bat` im Terminal `./start.sh` ausführen.

## 2. Wo der API-Schlüssel hinkommt

Ohne Schlüssel läuft die App im **Test-Modus**. Das kostet nichts. Die zwei Beispiel-Rechnungen werden dann trotzdem erkannt, bei anderen PDFs bekommst du ein leeres Formular.

Für die echte KI-Auslesung brauchst du einen Claude-API-Schlüssel:

1. Konto anlegen unter https://platform.claude.com. **Wichtig:** Man muss dafür mindestens 18 Jahre alt sein. Lass das Konto von einem Elternteil anlegen und bezahlen.
2. Unter „Billing“ Guthaben aufladen (mindestens ca. 5 $).
3. Unter „API Keys“ auf „Create Key“ klicken und den Schlüssel kopieren. Er beginnt mit `sk-ant-…`.
4. Öffne im Projektordner die Datei **`.env`** mit dem Editor (Rechtsklick → „Öffnen mit“ → „Editor“).
   Die Datei entsteht beim ersten Start automatisch.
5. Füge den Schlüssel hinter `ANTHROPIC_API_KEY=` ein (ohne Leerzeichen), speichere und starte die App neu.

**Kosten:** geschätzt 3–8 Cent pro Rechnung mit dem Standard-Modell `claude-opus-5-5`. In `.env` kannst du mit `CLAUDE_MODELL=claude-sonnet-5-5` ein günstigeres Modell wählen, das etwa die Hälfte kostet.

**Sicherheit:** Die Datei `.env` wird nie zu GitHub hochgeladen (siehe `.gitignore`). Gib den Schlüssel niemandem weiter.

## 3. Benutzen

1. PDF auswählen und auf „Rechnung auslesen“ klicken.
2. Die Daten kontrollieren. Rot markiert sind **Fehler**, die du beheben musst. Gelb markiert sind **Hinweise**.
   Rechts bei „Summen“ siehst du live, was die App nachgerechnet hat.
3. Auf „E-Rechnung erstellen“ klicken. Der Download `E-Rechnung_<Nummer>.pdf` startet.

**Tipp für Word:** „Speichern unter“ → „PDF“ → „Optionen…“ → Häkchen bei **„PDF/A-kompatibel“**. So wird das Ergebnis am zuverlässigsten ein gültiges PDF/A-3.

## 4. Selbst testen

- **Beispiel-Rechnungen:** im Ordner `beispiele/`
  - `rechnung_1_gartenbau.pdf` hat Positionen mit 19 % und 7 % Umsatzsteuer.
  - `rechnung_2_kleinunternehmer.pdf` ist eine Rechnung ohne Umsatzsteuer nach § 19 UStG.
  - Mit `python beispiele/erstellen.py` lassen sich die PDFs aus den `.json`-Dateien neu erzeugen.
- **Automatische Tests** (prüfen den kompletten Ablauf):
  `.venv\Scripts\python -m pytest` (Windows) bzw. `.venv/bin/python -m pytest`
- **Zweitprüfung mit Mustang** (verbreitetes, kostenloses ZUGFeRD-Prüfprogramm, braucht [Java](https://adoptium.net)):
  `.venv\Scripts\python werkzeuge\mustang_pruefen.py E-Rechnung_RE-2026-0147.pdf`
  Das prüft XML **und** PDF/A-3. Beim ersten Aufruf werden ca. 60 MB heruntergeladen.

## 5. Was die App prüft

| Stufe | Was | Womit |
|---|---|---|
| 1 | Summen, Pflichtangaben (§ 14 UStG), IBAN-Prüfziffer, Datumsangaben | eigene Prüfung (`app/pruefung.py`) |
| 2 | XML entspricht dem offiziellen Schema (XSD) | `drafthorse` / `factur-x` |
| 3 | XML erfüllt die offiziellen Geschäftsregeln EN 16931 (Schematron, z. B. BR-CO-10) | Schematron-Regeln aus `factur-x`, ausgeführt mit Saxon |
| 4 (optional) | Gesamtprüfung von PDF/A-3 und XML | Mustang (`werkzeuge/mustang_pruefen.py`) |

Stufe 1–3 laufen bei jeder E-Rechnung automatisch. Bei einem Fehler wird keine Datei erzeugt.

### Zum KoSIT-Validator

Der KoSIT-Validator konnte im Prototyp nicht eingebaut werden. In der Entwicklungsumgebung waren Docker und GitHub-Downloads gesperrt. Dazu kommt ein fachlicher Punkt: Die offizielle KoSIT-Konfiguration prüft **XRechnung**, nicht ZUGFeRD EN 16931. Für ZUGFeRD ist Mustang (Stufe 4) das passendere Werkzeug. Es nutzt intern dieselben EN-16931-Regeln und prüft zusätzlich PDF/A.

So lässt sich KoSIT später ergänzen, z. B. wenn ihr XRechnung für Behörden anbieten wollt:
1. Java installieren, dann von GitHub laden: `itplr-kosit/validator` (Datei `validator-…-standalone.jar`) und `itplr-kosit/validator-configuration-xrechnung` (ZIP entpacken).
2. Prüfen mit `java -jar validator-…-standalone.jar -s scenarios.xml -r <Konfig-Ordner> rechnung.xml`.
3. Alternativ als Docker-Container im Daemon-Modus (`-D`) betreiben und aus Python per HTTP-POST ansprechen, analog zu `werkzeuge/mustang_pruefen.py`.

## 6. Grenzen des Prototyps

- Nur Rechnungen (keine Gutschriften oder Stornos), nur Euro.
- Nur Steuersätze 19 % und 7 % sowie Kleinunternehmer (§ 19). Reverse Charge, steuerfreie Exporte usw. fehlen noch.
- Keine Rabatte oder Zuschläge auf Rechnungsebene.
- Kleinunternehmer ohne USt-IdNr.: Die Steuernummer wird zusätzlich als Verkäufer-Kennung eingetragen (Regel BR-CO-26 verlangt eine Kennung).
  Besser ist eine kostenlose USt-IdNr. vom Bundeszentralamt für Steuern.
- Ob das Ergebnis PDF/A-3 ist, hängt auch vom Original ab (z. B. eingebettete Schriften). Die App ergänzt automatisch ein fehlendes Farbprofil und eine fehlende Datei-Kennung.
  Zur Sicherheit mit Mustang prüfen.

## 7. Nächste Schritte: die App online stellen

1. **Hosting wählen.** Einfach und günstig ist z. B. Render.com oder Railway, ca. 5–10 €/Monat. Ein eigener kleiner Server (z. B. Hetzner) kostet ca. 5 €/Monat, macht aber mehr Arbeit.
2. **Dockerfile** hinzufügen, damit der Server die App gleich startet. Optional mit Java, damit Mustang auch online prüfen kann.
3. **API-Schlüssel** beim Hoster als „Environment Variable“ `ANTHROPIC_API_KEY` eintragen, nie in den Code.
4. **Eigene Domain und HTTPS.** Das machen Render/Railway automatisch.
5. **Rechtliches vor dem Start mit echten Kunden:**
   - Impressum und Datenschutzerklärung.
   - Auftragsverarbeitungsvertrag (AVV/DPA) mit Anthropic, weil Rechnungen personenbezogene Daten enthalten.
   - Mit Eltern bzw. Steuerberater klären, wie du als Minderjähriger ein Gewerbe betreiben darfst (Zustimmung der Eltern und des Familiengerichts).
6. **Schutz vor Missbrauch:** Login (z. B. per E-Mail-Link) und eine Begrenzung der Uploads pro Tag, damit niemand deine KI-Kosten in die Höhe treibt.
7. Danach: Bezahlung (z. B. Stripe), Rechnungsverlauf (Datenbank), E-Mail-Empfang, XRechnung für Behörden.

## Projektaufbau

```
app/
  main.py          Web-Server (Seiten und Abläufe)
  ki_auslesen.py   Claude-Anbindung und Test-Modus
  modelle.py       Datenmodell einer Rechnung und Nachrechnen der Summen
  pruefung.py      Prüfungen mit verständlichen Meldungen
  erechnung.py     XML erzeugen, gegen Regeln prüfen, ins PDF einbetten
  templates/       HTML-Seiten
  static/          Aussehen (CSS) und Formular-Helfer (JavaScript)
  daten/           Farbprofil sRGB für PDF/A
beispiele/         Zwei Beispiel-Rechnungen (PDF und die richtigen Daten als JSON)
tests/             Automatische Tests
werkzeuge/         Zusatzprüfung mit Mustang
start.bat          Start mit Doppelklick (Windows)
PROJEKT.md         Plan, Fortschritt und Zugangs-Infos
```
