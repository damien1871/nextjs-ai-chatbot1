"""Liest die Rechnungsdaten aus einem PDF – mit Claude oder (ohne API-Schlüssel) im Test-Modus."""

import base64
import io
import json
import os
from pathlib import Path

import anthropic
from pypdf import PdfReader

from app.modelle import EINHEITEN, Rechnung

MODELL = os.getenv("CLAUDE_MODELL", "claude-opus-5-5")
BEISPIEL_ORDNER = Path(__file__).resolve().parent.parent / "beispiele"

ANWEISUNG = f"""Du liest eine deutsche Rechnung (PDF) aus und gibst die Daten als JSON zurück.

Regeln:
- Übernimm Texte genau so, wie sie auf der Rechnung stehen. Erfinde nichts.
  Wenn eine Angabe fehlt, lass das Feld leer ("").
- Datumsangaben immer im Format JJJJ-MM-TT (z. B. 2026-03-15).
- Zahlen als Text mit Punkt als Dezimaltrenner und ohne Tausenderpunkte (z. B. "1234.50").
- Einzelpreis und Gesamtpreis jeder Position sind NETTO-Beträge. Wenn die Rechnung nur
  Brutto-Preise zeigt, rechne sie in Netto um.
- "gesamtpreis" ist der Zeilenbetrag, wie er auf der Rechnung gedruckt ist.
- Steuersatz als Zahl in Prozent ("19", "7" oder "0").
- Einheit: wähle den passenden Code aus dieser Liste: {", ".join(f"{k} = {v}" for k, v in EINHEITEN.items())}.
  Wenn nichts passt, nimm H87 (Stück).
- Leistungsdatum: Liefer- oder Leistungsdatum. Steht dort nur "Leistungsdatum entspricht
  Rechnungsdatum", nimm das Rechnungsdatum.
- Fälligkeit: das Datum, bis wann bezahlt werden muss. Steht dort z. B. "zahlbar innerhalb
  14 Tagen", rechne das Datum ab Rechnungsdatum aus.
- kleinunternehmer = true, wenn auf der Rechnung steht, dass keine Umsatzsteuer berechnet
  wird (z. B. "gemäß § 19 UStG").
- Land als Ländercode mit 2 Buchstaben (Deutschland = DE).
- summe_netto, summe_steuer, summe_brutto: die Summen, wie sie auf der Rechnung stehen."""


class AuslesenFehler(Exception):
    """Fehler mit einer Meldung, die man dem Nutzer zeigen kann."""


def testmodus_aktiv() -> bool:
    return os.getenv("TESTMODUS", "").lower() in ("1", "ja", "true") or not os.getenv("ANTHROPIC_API_KEY")


def auslesen(pdf: bytes) -> Rechnung:
    if testmodus_aktiv():
        return _testmodus(pdf)
    return _mit_claude(pdf)


def _mit_claude(pdf: bytes) -> Rechnung:
    client = anthropic.Anthropic()
    try:
        antwort = client.beta.messages.parse(
            model=MODELL,
            max_tokens=16000,
            output_config={"effort": "low"},
            # Falls das Modell eine Anfrage ablehnt, springt automatisch ein anderes Modell ein
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_format=Rechnung,
            system=ANWEISUNG,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": base64.standard_b64encode(pdf).decode(),
                            },
                        },
                        {"type": "text", "text": "Lies bitte diese Rechnung aus."},
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError as e:
        raise AuslesenFehler("Der Claude-API-Schlüssel ist ungültig. Bitte prüfe die Datei .env.") from e
    except anthropic.PermissionDeniedError as e:
        raise AuslesenFehler("Der API-Schlüssel hat keine Berechtigung (evtl. kein Guthaben).") from e
    except anthropic.RateLimitError as e:
        raise AuslesenFehler("Zu viele Anfragen an die KI. Bitte eine Minute warten.") from e
    except anthropic.BadRequestError as e:
        raise AuslesenFehler(f"Die KI konnte das PDF nicht verarbeiten: {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise AuslesenFehler("Keine Verbindung zur KI. Bist du mit dem Internet verbunden?") from e
    except anthropic.APIStatusError as e:
        raise AuslesenFehler(f"Die KI meldet einen Fehler ({e.status_code}). Bitte später nochmal versuchen.") from e

    if antwort.stop_reason == "refusal":
        raise AuslesenFehler("Die KI hat die Verarbeitung dieses Dokuments abgelehnt.")
    if antwort.stop_reason == "max_tokens" or antwort.parsed_output is None:
        raise AuslesenFehler("Die Antwort der KI war unvollständig. Bitte nochmal versuchen.")
    return antwort.parsed_output


def _testmodus(pdf: bytes) -> Rechnung:
    """Ohne KI: Erkennt die mitgelieferten Beispiel-Rechnungen, sonst leeres Formular."""
    try:
        text = "".join(seite.extract_text() or "" for seite in PdfReader(io.BytesIO(pdf)).pages)
    except Exception:
        text = ""
    for datei in sorted(BEISPIEL_ORDNER.glob("*.json")):
        daten = json.loads(datei.read_text(encoding="utf-8"))
        if daten["rechnungsnummer"] and daten["rechnungsnummer"] in text:
            return Rechnung.model_validate(daten)
    return Rechnung()
