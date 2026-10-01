"""Web-Oberfläche: PDF hochladen → Daten prüfen → E-Rechnung herunterladen.

Hochgeladene Dateien werden nirgends gespeichert: Das PDF bleibt nur im Arbeitsspeicher
und reist als verstecktes Formularfeld mit, bis die E-Rechnung erstellt ist.
"""

import base64
import binascii
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, Request, UploadFile  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from fastapi.responses import HTMLResponse, Response  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from fastapi.templating import Jinja2Templates  # noqa: E402

from app import ki_auslesen  # noqa: E402
from app.erechnung import ERechnungFehler, erstellen  # noqa: E402
from app.modelle import EINHEITEN, Rechnung, berechnen, euro  # noqa: E402
from app.pruefung import Hinweis, hat_fehler, pruefen  # noqa: E402

MAX_GROESSE = 10 * 1024 * 1024  # 10 MB
ORDNER = Path(__file__).resolve().parent

app = FastAPI(title="E-Rechnung aus PDF")
app.mount("/static", StaticFiles(directory=ORDNER / "static"), name="static")
vorlagen = Jinja2Templates(directory=ORDNER / "templates")
vorlagen.env.filters["euro"] = euro
vorlagen.env.filters["dezimal"] = lambda wert: str(wert).replace(".", ",") if re.fullmatch(r"-?\d+\.\d+", str(wert)) else wert


def startseite(request: Request, fehler: str = "", status: int = 200):
    return vorlagen.TemplateResponse(
        request,
        "start.html",
        {"testmodus": ki_auslesen.testmodus_aktiv(), "fehler": fehler},
        status_code=status,
    )


def formularseite(request: Request, r: Rechnung, pdf_b64: str, dateiname: str, zusatz: list[Hinweis] | None = None):
    hinweise = pruefen(r) + (zusatz or [])
    return vorlagen.TemplateResponse(
        request,
        "formular.html",
        {
            "r": r,
            "b": berechnen(r),
            "pdf_b64": pdf_b64,
            "dateiname": dateiname,
            "hinweise": hinweise,
            "fehler_anzahl": sum(h.stufe == "fehler" for h in hinweise),
            "warnungen_anzahl": sum(h.stufe == "warnung" for h in hinweise),
            "felder_fehler": {h.feld for h in hinweise if h.stufe == "fehler" and h.feld},
            "felder_warnung": {h.feld for h in hinweise if h.stufe == "warnung" and h.feld},
            "einheiten": EINHEITEN,
            "testmodus": ki_auslesen.testmodus_aktiv(),
        },
    )


@app.get("/", response_class=HTMLResponse)
def start(request: Request):
    return startseite(request)


@app.post("/hochladen", response_class=HTMLResponse)
async def hochladen(request: Request, datei: UploadFile):
    try:
        pdf = await datei.read(MAX_GROESSE + 1)
    finally:
        await datei.close()  # löscht eine eventuell angelegte Zwischendatei sofort

    if len(pdf) > MAX_GROESSE:
        return startseite(request, "Die Datei ist größer als 10 MB.", 400)
    if not pdf.startswith(b"%PDF"):
        return startseite(request, "Das ist keine PDF-Datei. Bitte eine Rechnung im PDF-Format hochladen.", 400)

    try:
        rechnung = await run_in_threadpool(ki_auslesen.auslesen, pdf)
    except ki_auslesen.AuslesenFehler as e:
        return startseite(request, str(e), 502)

    dateiname = Path(datei.filename or "rechnung.pdf").name
    return formularseite(request, rechnung, base64.b64encode(pdf).decode(), dateiname)


def formular_lesen(form) -> Rechnung:
    daten: dict = {"verkaeufer": {}, "kaeufer": {}, "kleinunternehmer": "kleinunternehmer" in form}
    positionen: dict[int, dict] = {}
    for schluessel, wert in form.multi_items():
        if not isinstance(wert, str) or schluessel in ("pdf_b64", "dateiname", "aktion", "kleinunternehmer"):
            continue
        if treffer := re.fullmatch(r"pos-(\d+)-(\w+)", schluessel):
            positionen.setdefault(int(treffer[1]), {})[treffer[2]] = wert
        elif "." in schluessel:
            partei, feld = schluessel.split(".", 1)
            if partei in ("verkaeufer", "kaeufer"):
                daten[partei][feld] = wert
        else:
            daten[schluessel] = wert
    daten["positionen"] = [positionen[i] for i in sorted(positionen)]
    return Rechnung.model_validate(daten)


@app.post("/erstellen", response_class=HTMLResponse)
async def erstellen_seite(request: Request):
    form = await request.form(max_part_size=20 * 1024 * 1024)
    pdf_b64 = str(form.get("pdf_b64", ""))
    dateiname = str(form.get("dateiname", "rechnung.pdf"))
    try:
        pdf = base64.b64decode(pdf_b64, validate=True)
    except (binascii.Error, ValueError):
        pdf = b""
    if not pdf.startswith(b"%PDF"):
        return startseite(request, "Das PDF ist verloren gegangen. Bitte lade es noch einmal hoch.", 400)

    r = formular_lesen(form)
    if form.get("aktion") != "erstellen":
        return formularseite(request, r, pdf_b64, dateiname)

    if hat_fehler(pruefen(r)):
        return formularseite(
            request, r, pdf_b64, dateiname, [Hinweis("fehler", "Bitte behebe zuerst die rot markierten Fehler.")]
        )

    try:
        ergebnis = await run_in_threadpool(erstellen, r, pdf)
    except ERechnungFehler as e:
        return formularseite(request, r, pdf_b64, dateiname, [Hinweis("fehler", m) for m in e.meldungen])

    name = re.sub(r"[^A-Za-z0-9_.-]", "_", r.rechnungsnummer) or "rechnung"
    return Response(
        ergebnis.pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="E-Rechnung_{name}.pdf"'},
    )
