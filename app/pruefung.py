"""Prüft eine Rechnung auf Rechenfehler und fehlende Pflichtangaben.

"fehler" verhindern das Erstellen der E-Rechnung, "warnung" sind nur Hinweise.
"""

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modelle import EINHEITEN, Rechnung, berechnen, euro, zahl

ERLAUBTE_STEUERSAETZE = {Decimal("19"), Decimal("7")}


@dataclass
class Hinweis:
    stufe: str  # "fehler" oder "warnung"
    text: str
    feld: str = ""  # Name des Formularfelds, das markiert werden soll


def _datum(text: str) -> date | None:
    try:
        return date.fromisoformat(text.strip())
    except ValueError:
        return None


def iban_gueltig(iban: str) -> bool:
    iban = iban.replace(" ", "").upper()
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", iban):
        return False
    if iban.startswith("DE") and len(iban) != 22:
        return False
    umgestellt = iban[4:] + iban[:4]
    ziffern = "".join(str(int(z, 36)) for z in umgestellt)
    return int(ziffern) % 97 == 1


def pruefen(r: Rechnung) -> list[Hinweis]:
    h: list[Hinweis] = []

    def fehler(text, feld=""):
        h.append(Hinweis("fehler", text, feld))

    def warnung(text, feld=""):
        h.append(Hinweis("warnung", text, feld))

    # --- Verkäufer und Käufer -------------------------------------------------
    for wer, partei, praefix in (("Verkäufer", r.verkaeufer, "verkaeufer"), ("Käufer", r.kaeufer, "kaeufer")):
        for feld, name in (("name", "Name"), ("strasse", "Straße"), ("plz", "PLZ"), ("ort", "Ort")):
            if not getattr(partei, feld).strip():
                fehler(f"{wer}: {name} fehlt. Eine Rechnung braucht die vollständige Anschrift.", f"{praefix}.{feld}")
        if not re.fullmatch(r"[A-Z]{2}", partei.land.strip()):
            fehler(f"{wer}: Land muss ein Ländercode mit 2 Großbuchstaben sein (z. B. DE).", f"{praefix}.land")

    v = r.verkaeufer
    if not v.ust_id.strip() and not v.steuernummer.strip():
        fehler("Verkäufer: Es fehlt die USt-IdNr. oder die Steuernummer. Eine davon ist Pflicht.", "verkaeufer.ust_id")
    if v.ust_id.strip() and not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{2,13}", v.ust_id.replace(" ", "")):
        fehler("Verkäufer: Die USt-IdNr. sieht ungültig aus (Beispiel: DE123456789).", "verkaeufer.ust_id")

    # --- Kopfdaten ----------------------------------------------------------------
    if not r.rechnungsnummer.strip():
        fehler("Die Rechnungsnummer fehlt.", "rechnungsnummer")

    rdatum = _datum(r.rechnungsdatum)
    if not rdatum:
        fehler("Das Rechnungsdatum fehlt oder ist ungültig.", "rechnungsdatum")

    if not r.leistungsdatum.strip():
        warnung(
            "Das Leistungsdatum fehlt. Wenn es dem Rechnungsdatum entspricht, trage bitte trotzdem das Datum ein.",
            "leistungsdatum",
        )
    elif not _datum(r.leistungsdatum):
        fehler("Das Leistungsdatum ist kein gültiges Datum.", "leistungsdatum")

    faellig = _datum(r.faelligkeit)
    if r.faelligkeit.strip() and not faellig:
        fehler("Die Fälligkeit ist kein gültiges Datum.", "faelligkeit")
    if not r.faelligkeit.strip() and not r.zahlungsbedingungen.strip():
        fehler("Bitte gib eine Fälligkeit oder Zahlungsbedingungen an.", "faelligkeit")
    if faellig and rdatum and faellig < rdatum:
        warnung("Die Fälligkeit liegt vor dem Rechnungsdatum. Ist das richtig?", "faelligkeit")

    if not r.iban.strip():
        warnung("Keine IBAN angegeben. Der Kunde sieht in der E-Rechnung dann keine Bankverbindung.", "iban")
    elif not iban_gueltig(r.iban):
        fehler("Die IBAN ist ungültig (Prüfziffer stimmt nicht). Bitte vergleiche sie mit der Rechnung.", "iban")

    # --- Positionen ----------------------------------------------------------------
    if not r.positionen:
        fehler("Die Rechnung braucht mindestens eine Position.")

    b = berechnen(r)
    for i, p in enumerate(r.positionen):
        nr = i + 1
        if not p.beschreibung.strip():
            fehler(f"Position {nr}: Die Beschreibung fehlt.", f"pos-{i}-beschreibung")
        if zahl(p.menge) is None:
            fehler(f"Position {nr}: Die Menge ist keine Zahl.", f"pos-{i}-menge")
        if zahl(p.einzelpreis) is None:
            fehler(f"Position {nr}: Der Einzelpreis ist keine Zahl.", f"pos-{i}-einzelpreis")
        if p.einheit not in EINHEITEN:
            fehler(f"Position {nr}: Bitte eine Einheit aus der Liste wählen.", f"pos-{i}-einheit")

        satz = zahl(p.steuersatz)
        if r.kleinunternehmer:
            if satz not in (None, Decimal("0")):
                warnung(
                    f"Position {nr}: Als Kleinunternehmer wird keine Umsatzsteuer berechnet. "
                    f"Der Steuersatz {p.steuersatz} % wird ignoriert.",
                    f"pos-{i}-steuersatz",
                )
        elif satz is None:
            fehler(f"Position {nr}: Der Steuersatz ist keine Zahl.", f"pos-{i}-steuersatz")
        elif satz == 0:
            fehler(
                f"Position {nr}: 0 % Umsatzsteuer geht im Prototyp nur mit Häkchen „Kleinunternehmer“. "
                "Andere steuerfreie Fälle (z. B. Reverse Charge) kommen später.",
                f"pos-{i}-steuersatz",
            )
        elif satz not in ERLAUBTE_STEUERSAETZE:
            warnung(f"Position {nr}: Ungewöhnlicher Steuersatz {p.steuersatz} %. In Deutschland üblich: 19 % oder 7 %.", f"pos-{i}-steuersatz")

        gedruckt = zahl(p.gesamtpreis)
        if gedruckt is not None and i < len(b.zeilen_netto) and gedruckt != b.zeilen_netto[i]:
            warnung(
                f"Position {nr}: Menge × Einzelpreis ergibt {euro(b.zeilen_netto[i])} €, "
                f"auf der Rechnung steht {euro(gedruckt)} €.",
                f"pos-{i}-gesamtpreis",
            )

    # --- Summen ----------------------------------------------------------------------
    for feld, name, berechnet in (
        ("summe_netto", "Nettosumme", b.netto),
        ("summe_steuer", "Umsatzsteuer", b.steuer),
        ("summe_brutto", "Bruttosumme", b.brutto),
    ):
        eingetragen = zahl(getattr(r, feld))
        if eingetragen is None:
            warnung(f"{name}: Kein Betrag eingetragen. Nachgerechnet: {euro(berechnet)} €.", feld)
            continue
        abweichung = abs(eingetragen - berechnet)
        if abweichung > Decimal("0.01"):
            fehler(
                f"{name} stimmt nicht: Auf der Rechnung stehen {euro(eingetragen)} €, "
                f"nachgerechnet sind es {euro(berechnet)} €. Bitte Positionen und Summen prüfen.",
                feld,
            )
        elif abweichung > 0:
            warnung(
                f"{name}: 1 Cent Rundungsdifferenz ({euro(eingetragen)} € statt {euro(berechnet)} €). "
                "In der E-Rechnung wird der nachgerechnete Betrag verwendet.",
                feld,
            )

    if r.positionen and b.brutto <= 0:
        fehler("Der Rechnungsbetrag muss größer als 0 sein. Gutschriften kommen in einer späteren Version.")

    return h


def hat_fehler(hinweise: list[Hinweis]) -> bool:
    return any(x.stufe == "fehler" for x in hinweise)
