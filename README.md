# Werkstatt-Check

Web-App für Privatleute in Deutschland: Kostenvoranschlag oder Werkstattrechnung (Foto oder PDF) hochladen und eine verständliche Einschätzung bekommen.

- alle Positionen sauber aufgelistet und erklärt
- Einstufung je Position: **notwendig**, **empfohlen, aber nicht dringend**, **fraglich – nachfragen**
- grobe Preis-Plausibilität, immer als Schätzung gekennzeichnet
- konkrete Fragen an die Werkstatt
- kurze Zusammenfassung in einfacher Sprache

> Orientierungshilfe – keine Rechtsberatung, kein Gutachten.

**Technik:** Next.js 16 · TypeScript · Tailwind CSS 4 · Anthropic API (`claude-opus-5-5`) · Hosting auf Vercel · Warteliste über Brevo

---

## 1. Welche Accounts brauche ich?

| Account | Wofür | Kosten |
|---|---|---|
| [GitHub](https://github.com) | Code speichern | kostenlos |
| [Vercel](https://vercel.com) (Hobby) | Website online stellen | kostenlos. Hobby ist nur für nicht-kommerzielle Projekte gedacht; sobald du Geld verdienst, brauchst du „Pro“ (ca. 20 $/Monat) |
| [Anthropic Console](https://platform.claude.com) | API-Key für die Analyse | nur Verbrauch, Guthaben wird vorab aufgeladen (ab ca. 5 $) |
| [Brevo](https://www.brevo.com) | Warteliste mit Double-Opt-in | kostenlos bis 300 Mails/Tag |

**Kosten pro Analyse (Schätzung):** ca. 5–12 Cent mit Claude Opus 5.5 (4 $ / 20 $ pro Million Ein-/Ausgabe-Tokens). 100 Analysen kosten also grob 5–12 €.

> **Wichtig:** Leg in der Anthropic Console unter *Settings → Limits* ein **monatliches Ausgabenlimit** fest (z. B. 20 $). Das ist deine harte Kostengrenze, falls jemand die Demo missbraucht.

---

## 2. Lokal starten (auf deinem Computer)

### Voraussetzungen
- **Node.js** in Version 20 oder neuer: https://nodejs.org (die „LTS“-Version herunterladen und installieren)
- Prüfen im Terminal: `node -v` sollte etwas wie `v22.x.x` anzeigen

### Schritte

```bash
# 1. Projekt herunterladen (einmalig)
git clone https://github.com/damien1871/nextjs-ai-chatbot1.git werkstatt-check
cd werkstatt-check

# 2. Pakete installieren (einmalig bzw. nach Updates)
npm install

# 3. Datei für geheime Schlüssel anlegen
cp .env.example .env.local
#    → .env.local in einem Editor öffnen und ANTHROPIC_API_KEY eintragen

# 4. Entwicklungs-Server starten
npm run dev
```

Dann im Browser öffnen: **http://localhost:3000**

### So testest du
| Was | Wie |
|---|---|
| Landingpage | http://localhost:3000 |
| Ergebnisanzeige **ohne** API-Key und ohne Kosten | http://localhost:3000/demo → „Beispiel-Ergebnis ansehen“ |
| Echte Analyse | http://localhost:3000/demo → Foto/PDF hochladen (braucht `ANTHROPIC_API_KEY`) |
| Warteliste | Formular auf der Startseite. Ohne Brevo-Daten läuft es im **Testmodus** (im Terminal steht dann „Testmodus“) |
| Am Handy testen | Handy im selben WLAN: `npm run dev -- -H 0.0.0.0`, dann `http://<IP-deines-Computers>:3000` aufrufen |

Zum Beenden des Servers im Terminal `Strg + C` drücken.

### Vor dem Hochladen prüfen
```bash
npm run typecheck   # findet Tippfehler im Code
npm run build       # baut die App wie auf Vercel
```

---

## 3. Umgebungsvariablen (geheime Einstellungen)

Die stehen in `.env.local` (lokal) bzw. in Vercel unter *Settings → Environment Variables*. Sie landen **nie** im Code oder im Browser.

| Name | Pflicht? | Bedeutung |
|---|---|---|
| `ANTHROPIC_API_KEY` | ja | API-Key aus der Anthropic Console |
| `ANTHROPIC_MODEL` | nein | Modell, Standard `claude-opus-5-5` |
| `BREVO_API_KEY` | für Warteliste | Brevo → *SMTP & API → API Keys* |
| `BREVO_LIST_ID` | für Warteliste | ID der Kontaktliste (Zahl) |
| `BREVO_DOI_TEMPLATE_ID` | für Warteliste | ID der Double-Opt-in-Vorlage (Zahl) |
| `NEXT_PUBLIC_SITE_URL` | für Warteliste | Adresse deiner Seite, z. B. `https://werkstatt-check.vercel.app` |
| `RATE_LIMIT_PER_HOUR` | nein | Analysen pro Besucher und Stunde, Standard `5` |

### Brevo einrichten (Warteliste)
1. Bei Brevo registrieren und den Absender (deine E-Mail-Adresse) bestätigen.
2. *Kontakte → Listen* → neue Liste „Warteliste“ anlegen → **ID** notieren.
3. *Kampagnen → Vorlagen* → neue Vorlage anlegen, als Typ **Double-Opt-in (DOI)** wählen. Der Bestätigungs-Button muss auf `{{ params.DOIurl }}` verlinken. **ID** notieren.
4. *SMTP & API → API Keys* → neuen Schlüssel erzeugen.
5. Die drei Werte in `.env.local` bzw. Vercel eintragen.

---

## 4. Online stellen (Deployment auf Vercel)

1. Den Code auf GitHub haben (ist schon der Fall).
2. Auf https://vercel.com mit dem GitHub-Account anmelden.
3. **Add New → Project** → das Repository `nextjs-ai-chatbot1` auswählen → **Import**.
4. Framework wird automatisch als „Next.js“ erkannt. Unter **Environment Variables** die Werte aus Abschnitt 3 eintragen. `NEXT_PUBLIC_SITE_URL` kannst du nach dem ersten Deploy auf die echte Adresse setzen.
5. **Deploy** klicken. Nach 1–2 Minuten ist die Seite unter `https://<name>.vercel.app` erreichbar.
6. Ab jetzt gilt: Jede Änderung, die auf GitHub landet, wird automatisch neu veröffentlicht. Branches bekommen eine eigene Vorschau-Adresse.

> Achtung: Vercel veröffentlicht standardmäßig den `main`-Branch. Diese Version liegt aktuell auf dem Branch `claude/werkstatt-check-app-ebxpf4`. Führe sie per Pull Request in `main` zusammen, oder wähle den Branch in Vercel als *Production Branch*.

**Eigene Domain:** In Vercel unter *Settings → Domains* hinzufügen und den DNS-Eintrag beim Domain-Anbieter setzen. Vercel zeigt dir genau an, welchen.

---

## 5. Die Analyse verbessern

Der System-Prompt liegt in **`lib/prompts/analyse-system-prompt.md`**. Das ist eine normale Textdatei, die du frei bearbeiten kannst. Im lokalen Entwicklungsmodus wirkt eine Änderung bei der nächsten Analyse, online nach dem nächsten Deployment.

- **Welche Felder** das Ergebnis hat, steht in `lib/analysis-schema.ts`.
- **Wie** das Ergebnis aussieht, steht in `components/AnalysisResult.tsx`.

Wenn du ein neues Feld einführst, musst du alle drei Dateien anpassen.

---

## 6. Ordnerstruktur

```
app/
  page.tsx                  Landingpage
  demo/                     Demo-Seite (Upload → Ergebnis)
  impressum/, datenschutz/  Rechtstexte (noch Platzhalter!)
  api/analyse/route.ts      Server: Datei prüfen → Claude → JSON zurück
  api/warteliste/route.ts   Server: E-Mail an Brevo (Double-Opt-in)
components/                 Bausteine der Oberfläche
lib/
  prompts/analyse-system-prompt.md   ★ der System-Prompt
  analysis-schema.ts        Format des KI-Ergebnisses
  anthropic.ts              Aufruf der Anthropic API
  rate-limit.ts             Missbrauchsschutz
  compress-image.ts         verkleinert Fotos im Browser
  sample-analysis.ts        Beispiel-Ergebnis zum Ausprobieren
```

---

## 7. Datenschutz – wie es umgesetzt ist

- Hochgeladene Dateien werden **nur im Arbeitsspeicher** verarbeitet und nicht gespeichert, weder auf der Festplatte noch in einer Datenbank. Nach der Antwort sind sie weg.
- Dateiinhalte und Ergebnisse werden **nicht geloggt**.
- Der System-Prompt verbietet der KI, Namen, Adressen, Kennzeichen oder Fahrgestellnummern ins Ergebnis zu übernehmen.
- Keine Cookies, kein Tracking.
- **Noch offen, bevor du live gehst:** Impressum und Datenschutzerklärung mit echten Angaben füllen und prüfen lassen. Außerdem die Auftragsverarbeitungsverträge (AVV/DPA) mit Vercel, Anthropic und Brevo abschließen; die gibt es bei den Anbietern in den Account-Einstellungen bzw. auf deren Websites.

---

## 8. Bekannte Grenzen (Phase 1)

- Das Limit pro Besucher ist nur „ungefähr“, weil Vercel mehrere Server-Instanzen nutzen kann. Die echte Kostengrenze ist das Ausgabenlimit in der Anthropic Console. Für ein exaktes Limit kann man später z. B. Upstash Redis anbinden.
- Pro Analyse wird eine Datei verarbeitet. Mehrseitige Kostenvoranschläge am besten als **ein PDF** hochladen.
- Noch keine Bezahlfunktion und keine Nutzerkonten (kommt in einer späteren Phase).
