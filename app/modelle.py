"""Datenmodell einer Rechnung – so, wie es die KI ausfüllt und das Formular anzeigt."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from pydantic import BaseModel, Field

# Einheiten nach UN/ECE-Empfehlung 20 (Pflicht in der E-Rechnung) mit deutschem Namen
EINHEITEN = {
    "H87": "Stück",
    "HUR": "Stunde",
    "DAY": "Tag",
    "MON": "Monat",
    "MTR": "Meter",
    "MTK": "Quadratmeter",
    "MTQ": "Kubikmeter",
    "KGM": "Kilogramm",
    "LTR": "Liter",
    "KMT": "Kilometer",
    "LS": "Pauschale",
}


class Partei(BaseModel):
    name: str = ""
    strasse: str = ""
    plz: str = ""
    ort: str = ""
    land: str = Field("DE", description="Ländercode mit 2 Buchstaben, z. B. DE, AT")


class Verkaeufer(Partei):
    ust_id: str = Field("", description="Umsatzsteuer-Identifikationsnummer, z. B. DE123456789")
    steuernummer: str = Field("", description="Steuernummer vom Finanzamt, z. B. 12/345/67890")


class Position(BaseModel):
    beschreibung: str = ""
    menge: str = "1"
    einheit: str = Field("H87", description="Einheitencode, siehe Liste")
    einzelpreis: str = Field("0", description="Netto-Einzelpreis in Euro")
    steuersatz: str = Field("19", description="Umsatzsteuersatz in Prozent, z. B. 19, 7 oder 0")
    gesamtpreis: str = Field("", description="Netto-Gesamtpreis der Zeile, wie auf der Rechnung gedruckt")


class Rechnung(BaseModel):
    verkaeufer: Verkaeufer = Verkaeufer()
    kaeufer: Partei = Partei()
    rechnungsnummer: str = ""
    rechnungsdatum: str = Field("", description="Format JJJJ-MM-TT")
    leistungsdatum: str = Field("", description="Format JJJJ-MM-TT")
    faelligkeit: str = Field("", description="Format JJJJ-MM-TT")
    zahlungsbedingungen: str = ""
    iban: str = ""
    bic: str = ""
    kleinunternehmer: bool = Field(False, description="True, wenn § 19 UStG (keine Umsatzsteuer)")
    positionen: list[Position] = []
    summe_netto: str = ""
    summe_steuer: str = ""
    summe_brutto: str = ""


def zahl(text) -> Decimal | None:
    """Wandelt '1.234,50', '1234.50' oder '1234,5 €' in eine Zahl um. None, wenn unlesbar."""
    if text is None:
        return None
    t = str(text).strip().replace("€", "").replace("EUR", "").replace("%", "").replace(" ", "")
    if not t:
        return None
    if "," in t and "." in t:
        # Das Zeichen, das zuletzt kommt, ist das Dezimaltrennzeichen
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")
        else:
            t = t.replace(",", "")
    elif "," in t:
        t = t.replace(",", ".")
    try:
        return Decimal(t)
    except InvalidOperation:
        return None


def runden(betrag: Decimal) -> Decimal:
    return betrag.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def euro(betrag: Decimal | None) -> str:
    """Formatiert eine Zahl deutsch: 1.234,50"""
    if betrag is None:
        return "–"
    s = f"{runden(betrag):,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


class Berechnung(BaseModel):
    """Von der App nachgerechnete Summen (werden in die E-Rechnung geschrieben)."""

    zeilen_netto: list[Decimal] = []
    steuergruppen: dict[str, dict[str, Decimal]] = {}  # "19" -> {"basis": .., "steuer": ..}
    netto: Decimal = Decimal("0")
    steuer: Decimal = Decimal("0")
    brutto: Decimal = Decimal("0")


def berechnen(r: Rechnung) -> Berechnung:
    b = Berechnung()
    for p in r.positionen:
        menge = zahl(p.menge) or Decimal("0")
        preis = zahl(p.einzelpreis) or Decimal("0")
        zeile = runden(menge * preis)
        b.zeilen_netto.append(zeile)
        satz = Decimal("0") if r.kleinunternehmer else (zahl(p.steuersatz) or Decimal("0"))
        schluessel = f"{satz.normalize():f}"
        gruppe = b.steuergruppen.setdefault(schluessel, {"basis": Decimal("0"), "steuer": Decimal("0")})
        gruppe["basis"] += zeile
    for satz, gruppe in b.steuergruppen.items():
        gruppe["steuer"] = runden(gruppe["basis"] * Decimal(satz) / 100)
    b.netto = sum(b.zeilen_netto, Decimal("0"))
    b.steuer = sum((g["steuer"] for g in b.steuergruppen.values()), Decimal("0"))
    b.brutto = b.netto + b.steuer
    return b
