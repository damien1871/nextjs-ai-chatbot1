"""Erstellt die Beispiel-Rechnungen (normale PDFs ohne E-Rechnungs-Daten) aus den JSON-Dateien.

Aufruf:  python beispiele/erstellen.py
"""

import json
import sys
from datetime import date
from pathlib import Path

from fpdf import FPDF

ORDNER = Path(__file__).resolve().parent
sys.path.insert(0, str(ORDNER.parent))

from app.modelle import EINHEITEN, Rechnung, berechnen, euro, zahl  # noqa: E402

SCHRIFT = Path("/usr/share/fonts/truetype/dejavu")


def datum(text: str) -> str:
    return date.fromisoformat(text).strftime("%d.%m.%Y")


def pdf_erstellen(r: Rechnung, ziel: Path) -> None:
    pdf = FPDF(format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.add_page()
    if (SCHRIFT / "DejaVuSans.ttf").exists():
        # Eingebettete Schrift – wie bei einem Word-Export
        pdf.add_font("Text", "", str(SCHRIFT / "DejaVuSans.ttf"))
        pdf.add_font("Text", "B", str(SCHRIFT / "DejaVuSans-Bold.ttf"))
        schrift = "Text"
    else:
        schrift = "helvetica"

    v, k = r.verkaeufer, r.kaeufer
    pdf.set_font(schrift, "B", 16)
    pdf.cell(0, 8, v.name, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(schrift, "", 9)
    pdf.cell(0, 5, f"{v.strasse} · {v.plz} {v.ort}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(12)

    pdf.set_font(schrift, "", 10)
    for zeile in (k.name, k.strasse, f"{k.plz} {k.ort}"):
        pdf.cell(0, 5, zeile, new_x="LMARGIN", new_y="NEXT")

    pdf.set_xy(118, 58)
    pdf.set_font(schrift, "", 9)
    angaben = [
        ("Rechnungsnummer:", r.rechnungsnummer),
        ("Rechnungsdatum:", datum(r.rechnungsdatum)),
        ("Leistungsdatum:", datum(r.leistungsdatum)),
    ]
    for titel, wert in angaben:
        pdf.set_x(118)
        pdf.cell(36, 5, titel)
        pdf.cell(0, 5, wert, new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(90)
    pdf.set_font(schrift, "B", 14)
    pdf.cell(0, 8, "Rechnung", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(schrift, "", 10)
    pdf.multi_cell(0, 5, "Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:")
    pdf.ln(3)

    spalten = [(10, "Pos."), (58, "Beschreibung"), (16, "Menge"), (22, "Einheit"), (24, "Einzelpreis")]
    if not r.kleinunternehmer:
        spalten.append((14, "USt"))
    rest = 170 - sum(b for b, _ in spalten)
    spalten.append((rest, "Gesamt"))

    pdf.set_font(schrift, "B", 9)
    pdf.set_fill_color(235, 235, 235)
    for breite, titel in spalten:
        pdf.cell(breite, 7, titel, border="B", fill=True, align="R" if titel not in ("Beschreibung", "Pos.", "Einheit") else "L")
    pdf.ln()

    pdf.set_font(schrift, "", 9)
    for i, p in enumerate(r.positionen, start=1):
        werte = [
            str(i),
            p.beschreibung,
            euro(zahl(p.menge)).rstrip("0").rstrip(",") if zahl(p.menge) % 1 else str(int(zahl(p.menge))),
            EINHEITEN[p.einheit],
            f"{euro(zahl(p.einzelpreis))} €",
        ]
        if not r.kleinunternehmer:
            werte.append(f"{p.steuersatz} %")
        werte.append(f"{euro(zahl(p.gesamtpreis))} €")
        for (breite, titel), wert in zip(spalten, werte):
            pdf.cell(breite, 7, wert, border="B", align="R" if titel not in ("Beschreibung", "Pos.", "Einheit") else "L")
        pdf.ln()

    b = berechnen(r)
    pdf.ln(3)
    summen = [("Summe netto", r.summe_netto)]
    if r.kleinunternehmer:
        summen.append(("Gesamtbetrag", r.summe_brutto))
    else:
        for satz, gruppe in b.steuergruppen.items():
            summen.append((f"zzgl. {satz} % USt auf {euro(gruppe['basis'])} €", str(gruppe["steuer"])))
        summen.append(("Gesamtbetrag", r.summe_brutto))
    for titel, wert in summen:
        pdf.set_font(schrift, "B" if titel == "Gesamtbetrag" else "", 10)
        pdf.cell(130, 6, titel, align="R")
        pdf.cell(40, 6, f"{euro(zahl(wert))} €", align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.set_font(schrift, "", 10)
    if r.kleinunternehmer:
        pdf.multi_cell(0, 5, "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.")
        pdf.ln(2)
    pdf.multi_cell(0, 5, f"{r.zahlungsbedingungen} Fällig am {datum(r.faelligkeit)}.")
    pdf.ln(2)
    pdf.multi_cell(0, 5, "Mit freundlichen Grüßen\n" + v.name)

    # Fußzeile mit Bank- und Steuerdaten
    iban = " ".join(r.iban[i : i + 4] for i in range(0, len(r.iban), 4))
    steuer = f"USt-IdNr.: {v.ust_id}" if v.ust_id else f"Steuernummer: {v.steuernummer}"
    bank = f"IBAN: {iban}" + (f" · BIC: {r.bic}" if r.bic else "")
    pdf.set_y(-30)
    pdf.set_font(schrift, "", 8)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(0, 4, f"{v.name} · {v.strasse} · {v.plz} {v.ort}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4, f"{bank} · {steuer}", align="C")

    pdf.set_title(f"Rechnung {r.rechnungsnummer}")
    pdf.set_author(v.name)
    pdf.output(str(ziel))


if __name__ == "__main__":
    for datei in sorted(ORDNER.glob("*.json")):
        rechnung = Rechnung.model_validate(json.loads(datei.read_text(encoding="utf-8")))
        ziel = datei.with_suffix(".pdf")
        pdf_erstellen(rechnung, ziel)
        print("Erstellt:", ziel.name)
