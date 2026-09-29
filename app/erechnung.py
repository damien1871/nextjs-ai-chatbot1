"""Erzeugt aus den geprüften Daten eine ZUGFeRD-E-Rechnung (Profil EN 16931).

1. XML erzeugen mit drafthorse (dabei automatische Prüfung gegen das offizielle XML-Schema)
2. XML gegen die offiziellen Geschäftsregeln (Schematron EN 16931) prüfen
3. XML mit factur-x in das Original-PDF einbetten (PDF/A-3)
"""

import io
import threading
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

import facturx
from drafthorse.models.accounting import ApplicableTradeTax
from drafthorse.models.document import Document
from drafthorse.models.note import IncludedNote
from drafthorse.models.party import TaxRegistration
from drafthorse.models.payment import PaymentMeans, PaymentTerms
from drafthorse.models.tradelines import LineItem
from lxml import etree
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, StreamObject, TextStringObject

from app.modelle import Rechnung, berechnen, zahl

KLEINUNTERNEHMER_TEXT = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)."
SCHEMATRON_DATEI = (
    Path(facturx.__file__).parent / "xsd_and_schematron" / "facturx-en16931" / "FACTUR-X_EN16931.xslt"
)


FARBPROFIL = Path(__file__).parent / "daten" / "sRGB2014.icc"


class ERechnungFehler(Exception):
    def __init__(self, meldungen: list[str]):
        super().__init__("\n".join(meldungen))
        self.meldungen = meldungen


@dataclass
class Ergebnis:
    pdf: bytes
    xml: bytes
    schematron_geprueft: bool
    schematron_warnungen: list[str]


def xml_erzeugen(r: Rechnung) -> bytes:
    b = berechnen(r)
    doc = Document()
    doc.context.guideline_parameter.id = "urn:cen.eu:en16931:2017"
    doc.header.id = r.rechnungsnummer.strip()
    doc.header.type_code = "380"  # 380 = Handelsrechnung
    doc.header.issue_date_time = date.fromisoformat(r.rechnungsdatum)

    if r.kleinunternehmer:
        notiz = IncludedNote()
        notiz.content = KLEINUNTERNEHMER_TEXT
        doc.header.notes.add(notiz)

    # Verkäufer
    v = r.verkaeufer
    verkaeufer = doc.trade.agreement.seller
    verkaeufer.name = v.name.strip()
    verkaeufer.address.line_one = v.strasse.strip()
    verkaeufer.address.postcode = v.plz.strip()
    verkaeufer.address.city_name = v.ort.strip()
    verkaeufer.address.country_id = v.land.strip()
    if v.ust_id.strip():
        verkaeufer.tax_registrations.add(TaxRegistration(id=("VA", v.ust_id.replace(" ", ""))))
    if v.steuernummer.strip():
        verkaeufer.tax_registrations.add(TaxRegistration(id=("FC", v.steuernummer.strip())))
        if not v.ust_id.strip():
            # Regel BR-CO-26: Ohne USt-IdNr. braucht der Verkäufer eine Kennung (BT-29).
            # Üblich ist, dafür die Steuernummer zu verwenden.
            verkaeufer.id = v.steuernummer.strip()

    # Käufer
    k = r.kaeufer
    kaeufer = doc.trade.agreement.buyer
    kaeufer.name = k.name.strip()
    kaeufer.address.line_one = k.strasse.strip()
    kaeufer.address.postcode = k.plz.strip()
    kaeufer.address.city_name = k.ort.strip()
    kaeufer.address.country_id = k.land.strip()

    # Leistungsdatum
    if r.leistungsdatum.strip():
        doc.trade.delivery.event.occurrence = date.fromisoformat(r.leistungsdatum)

    # Zahlung
    s = doc.trade.settlement
    s.currency_code = "EUR"
    s.payment_reference = r.rechnungsnummer.strip()
    if r.iban.strip():
        zahlart = PaymentMeans()
        zahlart.type_code = "58"  # 58 = SEPA-Überweisung
        zahlart.payee_account.iban = r.iban.replace(" ", "").upper()
        if r.bic.strip():
            zahlart.payee_institution.bic = r.bic.replace(" ", "").upper()
        s.payment_means.add(zahlart)
    if r.zahlungsbedingungen.strip() or r.faelligkeit.strip():
        bedingungen = PaymentTerms()
        if r.zahlungsbedingungen.strip():
            bedingungen.description = r.zahlungsbedingungen.strip()
        if r.faelligkeit.strip():
            bedingungen.due = date.fromisoformat(r.faelligkeit)
        s.terms.add(bedingungen)

    kategorie = "E" if r.kleinunternehmer else "S"  # E = steuerbefreit, S = Normalsteuersatz

    # Positionen
    for i, p in enumerate(r.positionen):
        satz = Decimal("0") if r.kleinunternehmer else zahl(p.steuersatz)
        zeile = LineItem()
        zeile.document.line_id = str(i + 1)
        zeile.product.name = p.beschreibung.strip()
        zeile.agreement.net.amount = zahl(p.einzelpreis)
        zeile.delivery.billed_quantity = (zahl(p.menge), p.einheit)
        zeile.settlement.trade_tax.type_code = "VAT"
        zeile.settlement.trade_tax.category_code = kategorie
        zeile.settlement.trade_tax.rate_applicable_percent = satz
        zeile.settlement.monetary_summation.total_amount = b.zeilen_netto[i]
        doc.trade.items.add(zeile)

    # Steueraufschlüsselung je Steuersatz
    for satz, gruppe in b.steuergruppen.items():
        steuer = ApplicableTradeTax()
        steuer.calculated_amount = gruppe["steuer"]
        steuer.basis_amount = gruppe["basis"]
        steuer.type_code = "VAT"
        steuer.category_code = kategorie
        if r.kleinunternehmer:
            steuer.exemption_reason = KLEINUNTERNEHMER_TEXT
        steuer.rate_applicable_percent = Decimal(satz)
        s.trade_tax.add(steuer)

    summen = s.monetary_summation
    summen.line_total = b.netto
    summen.tax_basis_total = b.netto
    summen.tax_total = (b.steuer, "EUR")
    summen.grand_total = b.brutto
    summen.due_amount = b.brutto

    # serialize() prüft automatisch gegen das offizielle XML-Schema (XSD)
    try:
        return doc.serialize(schema="FACTUR-X_EN16931")
    except etree.XMLSyntaxError as e:
        raise ERechnungFehler([f"Die erzeugte XML entspricht nicht dem Schema: {e}"]) from e


# --- Schematron-Prüfung (offizielle Geschäftsregeln EN 16931) --------------------------

_saxon_lock = threading.Lock()
_saxon = None


def _schematron_programm():
    global _saxon
    if _saxon is None:
        from saxonche import PySaxonProcessor

        prozessor = PySaxonProcessor(license=False)
        programm = prozessor.new_xslt30_processor().compile_stylesheet(stylesheet_file=str(SCHEMATRON_DATEI))
        _saxon = (prozessor, programm)
    return _saxon


def schematron_pruefen(xml: bytes) -> tuple[list[str], list[str]]:
    """Gibt (fehler, warnungen) zurück. Jede Meldung beginnt mit der Regel-Nummer, z. B. [BR-CO-10]."""
    with _saxon_lock:
        prozessor, programm = _schematron_programm()
        knoten = prozessor.parse_xml(xml_text=xml.decode("utf-8"))
        bericht = programm.transform_to_string(xdm_node=knoten)

    svrl = etree.fromstring(bericht.encode("utf-8"))
    ns = {"svrl": "http://purl.oclc.org/dsdl/svrl"}
    fehler, warnungen = [], []
    for eintrag in svrl.iterfind(".//svrl:failed-assert", ns):
        text = " ".join("".join(eintrag.find("svrl:text", ns).itertext()).split())
        regel = eintrag.get("id", "?")
        meldung = text if text.startswith(f"[{regel}]") else f"[{regel}] {text}"
        (warnungen if eintrag.get("flag") == "warning" else fehler).append(meldung)
    return fehler, warnungen


def farbprofil_ergaenzen(pdf: bytes) -> bytes:
    """PDF/A verlangt ein Farbprofil (OutputIntent). Fehlt es im Original, wird sRGB ergänzt.
    Das Aussehen des PDFs ändert sich dadurch nicht."""
    leser = PdfReader(io.BytesIO(pdf))
    if leser.is_encrypted:
        raise ERechnungFehler(["Das PDF ist verschlüsselt oder passwortgeschützt. Bitte ein ungeschütztes PDF hochladen."])
    if "/OutputIntents" in leser.trailer["/Root"]:
        return pdf

    schreiber = PdfWriter(clone_from=leser)
    profil = StreamObject()
    profil.set_data(FARBPROFIL.read_bytes())
    profil[NameObject("/N")] = NumberObject(3)
    absicht = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/OutputIntent"),
            NameObject("/S"): NameObject("/GTS_PDFA1"),
            NameObject("/OutputConditionIdentifier"): TextStringObject("sRGB IEC61966-2.1"),
            NameObject("/Info"): TextStringObject("sRGB IEC61966-2.1"),
            NameObject("/DestOutputProfile"): schreiber._add_object(profil),
        }
    )
    schreiber._root_object[NameObject("/OutputIntents")] = ArrayObject([schreiber._add_object(absicht)])
    ausgabe = io.BytesIO()
    schreiber.write(ausgabe)
    return ausgabe.getvalue()


def erstellen(r: Rechnung, original_pdf: bytes) -> Ergebnis:
    xml = xml_erzeugen(r)

    try:
        fehler, warnungen = schematron_pruefen(xml)
        geprueft = True
    except ImportError:
        fehler, warnungen, geprueft = [], [], False
    if fehler:
        raise ERechnungFehler(["Die E-Rechnung verletzt offizielle Regeln:", *fehler])

    pdf_mit_profil = farbprofil_ergaenzen(original_pdf)
    try:
        pdf = facturx.generate_from_binary(
            pdf_mit_profil,
            xml,
            flavor="factur-x",
            level="en16931",
            check_xsd=True,
            lang="de-DE",
        )
    except Exception as e:
        raise ERechnungFehler([f"Das PDF konnte nicht erzeugt werden: {e}"]) from e
    return Ergebnis(pdf=pdf, xml=xml, schematron_geprueft=geprueft, schematron_warnungen=warnungen)
