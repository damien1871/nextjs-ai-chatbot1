"""Testet den kompletten Ablauf mit den Beispiel-Rechnungen (im Test-Modus, ohne KI).

Starten:  .venv\\Scripts\\python -m pytest      (Windows)
          .venv/bin/python -m pytest           (Mac/Linux)
"""

import base64
import io
import json
import os
import shutil
from pathlib import Path

import facturx
import pytest
from pypdf import PdfReader

os.environ["TESTMODUS"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.erechnung import schematron_pruefen  # noqa: E402
from app.main import app  # noqa: E402
from app.modelle import Rechnung  # noqa: E402
from app.pruefung import hat_fehler, iban_gueltig, pruefen  # noqa: E402

BEISPIELE = Path(__file__).resolve().parent.parent / "beispiele"
NAMEN = ["rechnung_1_gartenbau", "rechnung_2_kleinunternehmer"]
client = TestClient(app)


def beispiel(name: str) -> tuple[dict, bytes]:
    daten = json.loads((BEISPIELE / f"{name}.json").read_text(encoding="utf-8"))
    return daten, (BEISPIELE / f"{name}.pdf").read_bytes()


def als_formular(daten: dict, pdf: bytes, aktion: str) -> dict:
    """Baut die Formulardaten so, wie der Browser sie abschickt."""
    form = {"pdf_b64": base64.b64encode(pdf).decode(), "dateiname": "test.pdf", "aktion": aktion}
    for partei in ("verkaeufer", "kaeufer"):
        for feld, wert in daten[partei].items():
            form[f"{partei}.{feld}"] = wert
    for i, pos in enumerate(daten["positionen"]):
        for feld, wert in pos.items():
            form[f"pos-{i}-{feld}"] = wert
    for feld, wert in daten.items():
        if isinstance(wert, str):
            form[feld] = wert
    if daten["kleinunternehmer"]:
        form["kleinunternehmer"] = "on"
    return form


def test_startseite():
    antwort = client.get("/")
    assert antwort.status_code == 200
    assert "PDF auswählen" in antwort.text


@pytest.mark.parametrize("name", NAMEN)
def test_hochladen_liest_daten_aus(name):
    daten, pdf = beispiel(name)
    antwort = client.post("/hochladen", files={"datei": (f"{name}.pdf", pdf, "application/pdf")})
    assert antwort.status_code == 200
    assert daten["rechnungsnummer"] in antwort.text
    assert "Alles in Ordnung" in antwort.text


def test_hochladen_lehnt_andere_dateien_ab():
    antwort = client.post("/hochladen", files={"datei": ("brief.txt", b"Hallo", "text/plain")})
    assert antwort.status_code == 400
    assert "keine PDF-Datei" in antwort.text


@pytest.mark.parametrize("name", NAMEN)
def test_kompletter_ablauf_erzeugt_gueltige_erechnung(name, tmp_path):
    daten, pdf = beispiel(name)
    antwort = client.post("/erstellen", data=als_formular(daten, pdf, "erstellen"))
    assert antwort.status_code == 200, antwort.text[:500]
    assert antwort.headers["content-type"] == "application/pdf"
    assert "attachment" in antwort.headers["content-disposition"]

    erechnung = antwort.content
    # XML ist eingebettet und besteht Schema- und Regelprüfung
    dateiname, xml = facturx.get_xml_from_pdf(erechnung, check_xsd=True)
    assert dateiname == "factur-x.xml"
    fehler, _ = schematron_pruefen(xml)
    assert fehler == []
    assert daten["rechnungsnummer"].encode() in xml
    assert daten["summe_brutto"].encode() in xml

    # Das Aussehen ist unverändert (gleicher Text auf allen Seiten)
    original = [s.extract_text() for s in PdfReader(io.BytesIO(pdf)).pages]
    neu = [s.extract_text() for s in PdfReader(io.BytesIO(erechnung)).pages]
    assert original == neu

    # Zusätzliche Prüfung mit Mustang (nur wenn Java + Mustang vorhanden sind)
    from werkzeuge.mustang_pruefen import JAR, pruefen as mustang

    if shutil.which("java") and JAR.exists():
        ziel = tmp_path / "erechnung.pdf"
        ziel.write_bytes(erechnung)
        ergebnis = mustang(ziel)
        assert ergebnis["pdf"], "PDF/A-3 ungültig"
        assert ergebnis["xml"], "XML ungültig"


def test_falsche_summe_blockiert_erstellen():
    daten, pdf = beispiel(NAMEN[0])
    daten["positionen"][0]["menge"] = "7"
    antwort = client.post("/erstellen", data=als_formular(daten, pdf, "erstellen"))
    assert antwort.headers["content-type"].startswith("text/html")
    assert "Nettosumme stimmt nicht" in antwort.text
    assert "markiert-fehler" in antwort.text


def test_pruefung_findet_fehlende_pflichtangaben():
    r = Rechnung()
    texte = " ".join(h.text for h in pruefen(r))
    assert hat_fehler(pruefen(r))
    for erwartet in ("Rechnungsnummer", "Rechnungsdatum", "USt-IdNr.", "mindestens eine Position"):
        assert erwartet in texte


def test_iban_pruefziffer():
    assert iban_gueltig("DE89 3704 0044 0532 0130 00")
    assert not iban_gueltig("DE89 3704 0044 0532 0130 01")


def test_deutsche_zahlen_werden_verstanden():
    daten, _ = beispiel(NAMEN[0])
    daten["positionen"][3]["menge"] = "1,5"
    daten["summe_brutto"] = "726,66 €"
    assert not hat_fehler(pruefen(Rechnung.model_validate(daten)))
