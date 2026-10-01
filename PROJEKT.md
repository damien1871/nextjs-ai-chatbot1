# PROJEKT.md – E-Rechnung aus PDF

> Diese Datei ist das Gedächtnis des Projekts. Lies sie am Anfang jeder neuen Sitzung und aktualisiere sie am Ende.
> **Hier stehen NIE geheime Schlüssel oder Passwörter.**

## Ziel

Kleine Betriebe laden eine normale PDF-Rechnung hoch. Die App liest die Daten mit KI aus, der Nutzer kontrolliert sie, und die App erzeugt eine gültige ZUGFeRD-E-Rechnung (Profil EN 16931, PDF/A-3), die genauso aussieht wie das Original.

## Über den Gründer (Arbeitsweise)

- Unter 18, keine Programmierkenntnisse, 5–10 Stunden pro Woche, Startbudget 100–500 €.
- Computer: **Windows**.
- Jeden Schritt, den er selbst machen muss, in einfachen deutschen Sätzen erklären: nummeriert, ein Schritt nach dem anderen, auf „erledigt“ warten.
- **Vor allem, was Geld kostet oder nicht rückgängig zu machen ist, immer erst fragen.**
- In kleinen Meilensteinen arbeiten. Nach jedem Meilenstein sagen, was fertig ist und wie man es im Browser testet.
- Technik so einfach wie möglich halten.

## Entscheidungen

| Datum | Entscheidung | Grund |
|---|---|---|
| 2026-09-29 | Python + FastAPI, einfache HTML-Seiten, kein Frontend-Framework | Wunsch des Gründers, wenig Bausteine |
| 2026-09-29 | Alte Next.js-Chatbot-Vorlage gelöscht (steht noch im Git-Verlauf) | nicht benötigt, übersichtlicher |
| 2026-09-29 | KI: Claude `claude-opus-5-5`, Aufwand „low“, strukturierte JSON-Ausgabe, automatisches Ersatzmodell bei Ablehnung | gute Qualität, per `.env` änderbar |
| 2026-09-29 | Test-Modus ohne API-Schlüssel (erkennt die Beispiel-Rechnungen) | kostenlos testen |
| 2026-09-29 | Kleinunternehmer (§ 19 UStG) unterstützt: Kategorie E, Steuernummer als Verkäufer-Kennung (BR-CO-26) | häufig bei kleinen Betrieben |
| 2026-09-29 | Kein Speichern: Das PDF reist als verstecktes Formularfeld mit | Datenschutz, keine Datenbank nötig |
| 2026-09-29 | Regelprüfung mit Schematron EN 16931 (aus `factur-x`) + Saxon, Zweitprüfung mit Mustang statt KoSIT | Docker und GitHub waren in der Cloud-Umgebung gesperrt. KoSIT-Standardkonfiguration prüft XRechnung, nicht ZUGFeRD |
| 2026-09-29 | Fehlendes PDF/A-Farbprofil (sRGB) wird automatisch ergänzt | ohne Profil ist das Ergebnis kein gültiges PDF/A-3 |
| 2026-10-01 | Fehlende Datei-Kennung (/ID) wird ebenfalls ergänzt | Chrome-„Als PDF drucken“ lieferte sonst kein gültiges PDF/A-3 |

## Meilensteine

- [x] **M1** Grundgerüst, PROJEKT.md, 2 Beispiel-Rechnungen
- [x] **M2** KI-Auslesung mit Claude (+ Test-Modus). ⚠️ Echte KI noch nicht mit gültigem Schlüssel getestet
- [x] **M3** Formular, Prüfungen und verständliche Warnungen (rot = Fehler, gelb = Hinweis, Summen live)
- [x] **M4** E-Rechnung erzeugen: XML (drafthorse), XSD- und Schematron-Prüfung, Einbettung (factur-x), PDF/A-3
- [x] **M5** Kompletter Test (10 automatische Tests + Mustang: beide Beispiele „gültig“), README
- [x] **M5b** Zweite Prüfung (01.10.): Chrome-PDF, 9-MB-PDF, kaputte Eingaben, passwortgeschütztes PDF, HTML in Feldern, schon vorhandene E-Rechnung. 2 Fehler gefunden und behoben (fehlende /ID; Mustang-Werkzeug meldete PDF/A-Fehler nicht im Gesamturteil). Jetzt 11 Tests
- [ ] **M6** Gründer testet lokal auf Windows (start.bat)
- [ ] **M7** Gründer testet echte KI mit eigenem API-Schlüssel (Konto durch Erwachsenen)
- [ ] **M8** Online stellen (siehe README, Abschnitt 7)

## Zugangs-Infos (ohne Geheimnisse)

| Was | Wo | Status |
|---|---|---|
| Code | GitHub `damien1871/nextjs-ai-chatbot1`, Branch `claude/app-development-founder-v1dwj6` | aktiv |
| Claude-API | https://platform.claude.com, Schlüssel gehört in die lokale Datei `.env` | noch nicht angelegt |
| Hosting | – | noch nicht gewählt |

Tipp: Das GitHub-Projekt heißt noch „nextjs-ai-chatbot1“. Umbenennen geht unter Settings → General → Repository name. Das ist optional.

## Wie man weitermacht (für die nächste Sitzung)

1. Diese Datei und die `README.md` lesen.
2. Tests laufen lassen: `python -m pytest`. Alle 11 müssen grün sein.
3. Offene Punkte: siehe Meilensteine M6–M8.

## Umsatzprognose (Stand 01.10.2026, reine Annahmen, noch keine echten Kunden)

Annahmen: Gratis-Plan (2 Rechnungen/Monat), Basis 9 €/Monat, Pro 19 €/Monat, Ø 11 € pro zahlendem Kunden.
Erste Einnahmen ab Dez 2026 (realistisch). Kosten: Hosting/Domain 8 €/Monat, KI ca. 5 Cent pro Rechnung, Stripe 1,5 % + 0,25 €.
Markt: Pflicht zum Ausstellen ab 1.1.2027 nur bei >800.000 € Vorjahresumsatz, für alle anderen ab 1.1.2028. Kleinunternehmer (§ 19) sind dauerhaft befreit.

| Szenario | Kunden Ende Sep 27 | Monatsumsatz Sep 27 | Umsatz 12 Monate | Gewinn 12 Monate |
|---|---|---|---|---|
| Pessimistisch | 14 | 154 € | ca. 600 € | ca. 400 € |
| Realistisch | 50 | 550 € | ca. 2.600 € | ca. 2.100 € |
| Optimistisch | 147 | 1.617 € | ca. 7.200 € | ca. 6.200 € |

Nächster Schritt dafür: mit 10 echten Betrieben sprechen und den Preis testen, bevor weitergebaut wird.

## Ideen für später

- Reverse Charge (§ 13b), steuerfreie Lieferungen, Rabatte/Zuschläge, Gutschriften
- XRechnung für Behörden (+ KoSIT-Validator)
- Login, Bezahlung, Rechnungsverlauf, E-Mail-Empfang
- Mustang-Prüfung direkt in der Web-App anzeigen (online mit Java im Docker-Image)
