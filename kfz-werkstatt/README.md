# Website Kfz-Meisterbetrieb Marco Malingriaux

One-Page-Website aus reinem HTML, CSS und etwas JavaScript. Kein Framework, kein Build-Schritt,
keine Google Fonts, keine Tracker, keine Cookies.

```
kfz-werkstatt/
├── index.html         Startseite (alle Abschnitte)
├── impressum.html     Impressum-VORLAGE
├── datenschutz.html   Datenschutz-VORLAGE
├── style.css          Gestaltung (Farben ganz oben in :root)
├── script.js          Menü, Öffnungsstatus, Formular, Karte, Scroll-Effekt
└── images/
    ├── favicon.svg
    ├── og-image.png           Vorschaubild beim Teilen (1200 × 630, fertig nutzbar)
    ├── werkstatt-innen.svg    PLATZHALTER-Foto
    └── werkstatt-aussen.svg   PLATZHALTER-Foto
```

**Ansehen:** `index.html` doppelt anklicken, sie öffnet sich im Browser.
**Online stellen:** Den ganzen Ordner per FTP oder im Dateimanager Ihres Hosters hochladen. Fertig.

---

## Was Sie noch ersetzen müssen

Alles in eckigen Klammern ist ein Platzhalter. Mit „Suchen“ im Editor nach `[` suchen findet alles.

### 1. E-Mail-Adresse `[E-Mail]`

| Datei | Stelle |
|---|---|
| `index.html` | JSON-LD im `<head>` (`"email"`) |
| `index.html` | Formular: `action="mailto:[E-Mail]"` **und** `data-email="[E-Mail]"` |
| `index.html` | Kontaktbereich: Link `mailto:[E-Mail]` und sichtbarer Text |
| `impressum.html`, `datenschutz.html` | je einmal |

### 2. Domain `[IHRE-DOMAIN]`

In `index.html` im `<head>`: `canonical`, `og:url`, `og:image` und zweimal im JSON-LD
(`url`, `image`). Beispiel: `https://www.kfz-malingriaux.de/`.

### 3. Formularversand

Standardmäßig öffnet das Formular das E-Mail-Programm der Besucher mit einer fertig
ausgefüllten Nachricht (mailto). Das funktioniert ohne Zusatzdienst, aber nur, wenn
auf dem Gerät ein Mailprogramm eingerichtet ist.

Zuverlässiger ist **Formspree** (kostenloser Tarif reicht für eine Werkstatt):

1. Auf formspree.io ein Konto anlegen, ein Formular erstellen, die Adresse kopieren
   (sieht aus wie `https://formspree.io/f/abcdwxyz`).
2. In `index.html` beim Formular `data-formspree="[FORMSPREE-ENDPOINT]"` durch diese Adresse ersetzen.
3. In `datenschutz.html` Abschnitt 5 **Variante B** behalten, Variante A löschen
   (und den Platzhalter zur US-Übermittlung ausfüllen).

Solange beides noch Platzhalter ist, zeigt das Formular einen Hinweis „Bitte rufen Sie uns an“.

### 4. Weitere Leistung `[Weitere Leistung]`

In `index.html` im Abschnitt Leistungen gibt es eine gestrichelte Platzhalter-Karte.
Ausfüllen oder löschen. Für mehr Leistungen einen kompletten `<li class="service-card">…</li>`-Block
kopieren. Die Platzhalter-Karte hat zusätzlich die Klasse `service-card-placeholder`;
die beim Ausfüllen entfernen, sonst bleibt sie gestrichelt.

### 5. Fotos

Die zwei SVG-Platzhalter durch echte Fotos ersetzen (am besten JPG oder WebP,
ca. 1200 × 800 px, unter 250 KB):

- `werkstatt-innen` (Abschnitt „Warum wir“): z. B. Marco am Oszilloskop
- `werkstatt-aussen` (Abschnitt Kontakt): Einfahrt und Firmenschild, damit man Sie findet

Neue Datei in `images/` legen, in `index.html` den Dateinamen im `src` anpassen und den
`alt`-Text so ändern, dass er beschreibt, was wirklich auf dem Foto zu sehen ist.
Bei anderem Seitenverhältnis auch `width`/`height` anpassen.

### 6. Kartenposition prüfen

Die Koordinaten der OpenStreetMap-Karte sind **ungefähr** gesetzt (Schaafheim).
So bekommen Sie die genaue Position:

1. Auf openstreetmap.org nach „Industriering 2, Schaafheim“ suchen.
2. Rechts auf „Teilen“ klicken, „HTML“ wählen, Häkchen bei „Markierung auf der Karte einfügen“.
3. Aus dem angezeigten Code den Wert von `src="…"` kopieren.
4. In `index.html` beim `<div class="map" … data-src="…">` einsetzen.

Die Karte lädt erst nach Klick auf „Karte laden“, damit vorher keine Daten an OpenStreetMap gehen.

### 7. Absatz „Parkplätze direkt vor der Tür“

Steht im Kontaktbereich. Nur stehen lassen, wenn es stimmt.

### 8. Impressum und Datenschutz

Beide Seiten sind **Vorlagen und nicht rechtsverbindlich**. Orange markierte Stellen
ausfüllen (Rechtsform, USt-IdNr., Handwerkskammer, Hoster usw.) und vor dem Livegang prüfen
lassen, z. B. von der Handwerkskammer, der Kfz-Innung oder einem Anwalt. Danach den orangen
Warnkasten oben auf beiden Seiten löschen.

---

## Gut zu wissen

- **Google-Bewertung:** Die Seite nennt nur „5,0 bei Google aus über 30 Rezensionen“.
  Wenn sich die Zahl ändert, in `index.html` in der Vertrauensleiste anpassen.
  Bewusst nicht im JSON-LD hinterlegt: Google wertet Sterne, die ein Betrieb über
  sich selbst auszeichnet, nicht als Rich Snippet und sieht das nicht gern.
- **Öffnungsstatus:** Unter den Hero-Buttons steht live „Jetzt geöffnet“ bzw. „Gerade geschlossen“
  (deutsche Zeit). Feiertage und Urlaub kennt die Seite nicht. Ändern sich die Öffnungszeiten,
  in `index.html` (Hero, Kontakt, Termin-Kasten, JSON-LD) und in `script.js` (`OPEN`, `CLOSE`) anpassen.
- **Farben:** ganz oben in `style.css` unter `:root`.
- **Telefonnummer ändern:** in allen Dateien nach `8373696` suchen (sichtbarer Text und `tel:+49…`-Links).
- **Barrierefreiheit:** Sprunglink zum Inhalt, sichtbarer Tastaturfokus, Formular mit
  verständlichen Fehlermeldungen, reduzierte Bewegung wird respektiert.
- **Test nach Änderungen:** Seite auf dem Handy öffnen, einmal auf „Jetzt anrufen“ tippen,
  einmal das Formular abschicken, einmal „Karte laden“ klicken.
