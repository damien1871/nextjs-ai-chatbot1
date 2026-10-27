# V-MAX Autoservice – Website

Statische One-Page-Website (plus Impressum und Datenschutz) für die freie Kfz-Werkstatt V-MAX Autoservice, Groß-Umstadt.
Astro (statischer Output) und Tailwind CSS. Kein Framework-JavaScript, keine Cookies, keine externen Anfragen.

> **Wichtig:** Die Seite enthält noch sichtbare `[PLATZHALTER: …]` und ist standardmäßig auf `noindex` gestellt.
> Sie darf erst live gehen, wenn alle Platzhalter ersetzt sind (siehe [Go-live-Checkliste](#go-live-checkliste)).

## Voraussetzungen

- Node.js 22.22 oder neuer (von Astro 7 verlangt)
- npm

## Befehle

```bash
npm install          # Abhängigkeiten installieren
npm run dev          # Entwicklungsserver (http://localhost:4321)
npm run build        # Produktions-Build nach dist/ + automatische Prüfung (scripts/check-dist.mjs)
npm run preview      # gebaute Seite lokal ansehen
npm run platzhalter  # alle sichtbaren [PLATZHALTER] aus dist/ auflisten (nach dem Build)
```

### Build für den Livebetrieb

Die Domain und der Indexierungs-Schalter kommen über Umgebungsvariablen:

```bash
SITE_URL=https://www.ihre-domain.de SEITE_LIVE=1 npm run build
```

| Variable | Wirkung | Standard |
|---|---|---|
| `SITE_URL` | Domain für Canonical, Open Graph, Sitemap, `robots.txt`, JSON-LD | `https://platzhalter-domain.example` |
| `SEITE_LIVE=1` | schaltet `noindex` ab (`index, follow`) | nicht gesetzt = `noindex, nofollow` |

`npm run build` bricht ab, wenn in `dist/` ein `<style>`-Block, ein `style=`-Attribut, ein Inline-Event-Handler, ein Inline-`<script>`
(außer dem JSON-LD-Datenblock) oder eine externe Ressource steckt.

## Upload per SFTP (deutscher Webhoster)

Die genauen Bezeichnungen unterscheiden sich je nach Hoster (z. B. IONOS, STRATO, all-inkl, netcup, Hetzner). Der Ablauf ist überall gleich:

1. **Zugangsdaten holen:** Im Kundenmenü des Hosters unter „SFTP“, „FTP-Zugang“ oder „Webspace“ Server, Benutzername und Passwort nachsehen. Immer **SFTP (Port 22)** verwenden, nicht unverschlüsseltes FTP.
2. **Build erzeugen:** `SITE_URL=https://www.ihre-domain.de SEITE_LIVE=1 npm run build`
3. **Mit einem SFTP-Programm verbinden**, z. B. FileZilla, WinSCP, Cyberduck oder auf der Kommandozeile `sftp benutzer@server`.
4. **Zielordner öffnen:** Das ist das Hauptverzeichnis der Domain (oft `htdocs`, `html`, `public_html` oder ein Ordner mit dem Domainnamen). Alte Platzhalterseiten des Hosters vorher entfernen.
5. **Den Inhalt von `dist/` hochladen**, nicht den Ordner `dist` selbst. Es muss also `index.html` direkt im Hauptverzeichnis liegen.
6. **`.htaccess` nicht vergessen:** Die Datei beginnt mit einem Punkt und wird von manchen Programmen versteckt. In FileZilla unter „Server → Versteckte Dateien anzeigen“ aktivieren. Ohne `.htaccess` fehlen alle Sicherheits-Header und die HTTPS-Weiterleitung.
7. **HTTPS aktivieren:** Im Kundenmenü ein (meist kostenloses) SSL-Zertifikat für die Domain einrichten, bevor die Weiterleitung greift.
8. **Testen:**
   - `http://ihre-domain.de` leitet auf `https://` weiter
   - `/impressum`, `/datenschutz` und eine nicht vorhandene Adresse (404-Seite) funktionieren
   - Header prüfen, z. B. mit `curl -sI https://www.ihre-domain.de/` oder securityheaders.com
9. **Aktualisieren:** Nach jeder Änderung erneut bauen und hochladen. Dateien in `_astro/` haben Hashes im Namen, alte Dateien dürfen gelöscht werden.

Voraussetzung auf dem Server: **Apache** mit `mod_rewrite` und `mod_headers` (bei fast allen Hostern aktiv). Bei nginx-Hostern wird `.htaccess` ignoriert. Dann müssen die Header in der Serverkonfiguration gesetzt werden.

## Platzhalter (vom Inhaber zu liefern)

Alle im Seitentext sichtbaren Platzhalter erscheinen als `[PLATZHALTER: …]` in gestrichelten Kästen. Die aktuelle Liste erzeugt `npm run platzhalter`. Stand beim Anlegen:

| Platzhalter | Wo | Wird ersetzt in |
|---|---|---|
| Logo / Originalschriftzug „V-MAX“ | Kopfzeile aller Seiten | `src/layouts/Base.astro` (Logo-Datei dann nach `src/assets/` legen) |
| Foto der Werkstatt (außen / Werkstattbereich) | Hero | `src/components/Hero.astro` (Prop `src` bei `<Foto>`) |
| Foto Einfahrt / Außenansicht | Anfahrt | `src/components/Zeiten.astro` |
| Einleitung und genaue Leistungen (6 Kacheln, „vom Inhaber bestätigen“) | Leistungen | `src/components/Leistungen.astro` |
| Datum (Stand der Google-Bewertung) | Typenschild im Hero | `bewertungStand` in `src/data/betrieb.ts` |
| Link zum Google-Profil | Typenschild im Hero | `googleProfilUrl` in `src/data/betrieb.ts` |
| E-Mail-Adresse | Kontakt, Impressum | `email` in `src/data/betrieb.ts` (der `mailto:`-Link entsteht automatisch) |
| Impressum-Text aus dem Generator | `/impressum` | `src/pages/impressum.astro` |
| Name und Rechtsform | `/impressum` | dito |
| USt-IdNr., falls vorhanden | `/impressum` | dito |
| Zuständige Handwerkskammer | `/impressum` | dito |
| Berufsbezeichnung | `/impressum` | dito |
| Staat der Verleihung der Berufsbezeichnung | `/impressum` | dito |
| Link zur Handwerksordnung (HwO) | `/impressum` | dito |
| Datenschutzerklärung aus dem Generator | `/datenschutz` | `src/pages/datenschutz.astro` |

Außerdem noch **nicht geliefert** und deshalb nicht auf der Seite (nichts erfunden):

- **Domain** (siehe `SITE_URL`)
- Inhabername, Marken, Preise, Teamfotos
- Preise erscheinen nur, wenn der Inhaber sie liefert, dann als Endpreise inklusive MwSt.

Die Favicons und das Open-Graph-Bild sind neutrale Platzhalter ohne Logo (gelbe Maßlinie auf Anthrazit bzw. reiner Text). Sie werden mit `node tools/erzeuge-assets.mjs` neu erzeugt, sobald ein Logo vorliegt.

## Go-live-Checkliste

1. Alle Platzhalter ersetzen (`npm run platzhalter` zeigt, was noch fehlt).
2. Koordinaten (`geo` in `src/data/betrieb.ts`, derzeit `49.8729 / 8.9173`) in Google Maps gegenprüfen.
3. Domain festlegen und mit `SITE_URL` und `SEITE_LIVE=1` bauen.
4. Hochladen, HTTPS aktivieren, Header testen.
5. Sitemap (`/sitemap-index.xml`) in der Google Search Console einreichen.

## Sicherheits-Header (`public/.htaccess`)

| Header | Wert |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Weitere Einstellungen in der `.htaccess`: Weiterleitung HTTP → HTTPS (mit Schutz vor Schleifen hinter Proxys), `Options -Indexes`, 404-Seite, UTF-8, Dateitypen, Kompression und ein Jahr Cache für die gehashten Dateien in `/_astro/`.

> **Hinweis zu HSTS:** Browser merken sich den Header ein Jahr lang. Erst setzen, wenn HTTPS dauerhaft für die Domain und alle Subdomains funktioniert.

### CSP ohne `'unsafe-inline'`: wie das funktioniert

Astro bettet kleine Stylesheets standardmäßig als `<style>` in die HTML-Seite ein (`build.inlineStylesheets: 'auto'`). Das würde `style-src 'self'` verletzen. Deshalb:

- `astro.config.mjs`: `build.inlineStylesheets: 'never'`, das CSS liegt immer in einer eigenen Datei unter `/_astro/`.
- `vite.build.assetsInlineLimit: 0`: Schriften und Bilder werden nie als `data:`-URI eingebettet. Schriften wären sonst durch `default-src 'self'` blockiert.
- Im Code gibt es keine `style="…"`-Attribute. Layout-Werte laufen über Tailwind-Klassen.
- `scripts/check-dist.mjs` prüft das bei jedem Build.

**Eine bewusste Ausnahme von „kein Inline-Script“:** Die strukturierten Daten (JSON-LD, Typ `AutoRepair`) stehen als `<script type="application/ld+json">` in der Seite. Das ist ein reiner Datenblock, der nie ausgeführt wird und von `script-src` nicht betroffen ist. Suchmaschinen lesen ihn nur inline. Ausführbares JavaScript gibt es auf der Seite nicht.

Die Anruf-Leiste am Smartphone und die Scroll-Animation sind reines CSS. Die Animation (zeichnende Maßlinien und Messskala) läuft nur mit `prefers-reduced-motion: no-preference` und nur in Browsern mit `animation-timeline`. Sonst sind alle Linien einfach sichtbar.

## Datenschutz-Hinweise für den Generator

Der Text der Datenschutzerklärung kommt aus einem Generator. Diese technischen Fakten der Seite gehören hinein:

- keine Cookies, kein `localStorage`, kein Tracking, keine Webanalyse, kein Kontaktformular
- Schriften liegen lokal auf dem eigenen Server (kein Google-Fonts-Abruf)
- keine eingebettete Karte. Die Links „Route planen“ und „Route in Google Maps öffnen“ sowie der Link zum Google-Profil sind normale Links, Daten fließen erst nach einem Klick
- Telefon- und E-Mail-Links öffnen die Apps auf dem Gerät
- der Hoster verarbeitet technisch bedingt Server-Logfiles (IP-Adresse). Details stehen im Vertrag zur Auftragsverarbeitung des Hosters

Zur Bewertung: Auf der Seite stehen nur Durchschnitt (5,0), Anzahl (47) und Stand-Datum mit Link zum Google-Profil. Es werden keine Bewertungstexte übernommen. Das JSON-LD enthält bewusst kein `aggregateRating`.

## Projektstruktur

```
src/data/betrieb.ts        alle Fakten (Name, Adresse, Zeiten, Platzhalter-Felder), eine Quelle für Seite und JSON-LD
src/layouts/Base.astro     Head (SEO, Open Graph, JSON-LD), Skip-Link, Kopfzeile, Footer, Anruf-Leiste
src/components/            Hero, Typenschild, Leistungen, WarumWir, Ablauf, Zeiten, Kontakt, Foto, Platzhalter, …
src/pages/                 index, impressum, datenschutz, 404, robots.txt
src/styles/global.css      Tailwind, Farb- und Schrift-Tokens, Komponenten-Klassen, Scroll-Animation
public/                    .htaccess, Favicons, Open-Graph-Bild, Raster-SVG, Webmanifest
scripts/                   Build-Prüfung (check-dist), Platzhalter-Liste
tools/                     Hilfswerkzeuge für Tests (benötigen Playwright, nicht Teil der Abhängigkeiten)
```

### Echte Fotos einbauen

Fotos in `src/assets/photos/` ablegen und der Komponente `<Foto>` als `src` übergeben:

```astro
---
import werkstatt from '../assets/photos/werkstatt.jpg';
---
<Foto src={werkstatt} alt="Beschreibung des Fotos" platzhalter="" />
```

Astro erzeugt daraus AVIF und WebP mit `width`/`height`. Der Alt-Text ist Pflicht.

## Qualitätsnachweis (Stand Erstellung)

Gemessen mit Lighthouse (mobil, Live-Konfiguration mit `SEITE_LIVE=1`) gegen einen lokalen Testserver mit den Headern aus der `.htaccess`:

| Kategorie | Ergebnis |
|---|---|
| Performance | 100 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

Weitere Prüfungen (Werkzeuge in `tools/`):

- `node tools/test-server.mjs`: liefert `dist/` mit den Headern aus der `.htaccess` aus
- `node tools/netzwerk-check.mjs`: Playwright prüft alle Seiten bei 375 und 1440 px. Ergebnis: nur Requests an den eigenen Host, keine Cookies, kein Web-Storage, keine ausführbaren Scripts, keine CSP-Meldungen
- `node tools/screenshots.mjs <Ordner>`: Screenshots bei 375, 768 und 1440 px
- `npm audit`: 0 Schwachstellen

**Nicht geprüft:** Die `.htaccess` selbst wurde nicht auf einem echten Apache getestet (hier steht keiner zur Verfügung). Der Testserver setzt dieselben Header, die Weiterleitungs- und Cache-Regeln sind aber ungetestet. Bitte nach dem Upload die Punkte unter „Testen“ durchgehen. Auch die HSTS-Wirkung lässt sich nur über HTTPS prüfen.

## Barrierefreiheit (WCAG 2.2 AA)

Semantisches HTML mit einer `h1` je Seite, Skip-Link, sichtbarer Fokus (3 px Gelb), Tastaturbedienung, Kontraste über 4,5:1, Schrift mindestens 16 px, Klickziele mindestens 44 px, Bewegung nur bei `prefers-reduced-motion: no-preference`. Dekorative Elemente (Maßlinien, Messskala) sind für Screenreader ausgeblendet. Die Öffnungszeiten stehen als echte Tabelle in der Seite.
