"""Zusätzliche Prüfung einer fertigen E-Rechnung mit dem Mustang-Validator.

Mustang ist ein verbreitetes, kostenloses Prüfprogramm für ZUGFeRD/Factur-X. Es prüft
das eingebettete XML UND ob das PDF wirklich PDF/A-3 ist. Benötigt Java.

Aufruf:   python werkzeuge/mustang_pruefen.py E-Rechnung_RE-2026-0147.pdf
"""

import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

VERSION = "2.26.0"
JAR = Path(__file__).resolve().parent / f"Mustang-CLI-{VERSION}.jar"
URL = f"https://repo1.maven.org/maven2/org/mustangproject/Mustang-CLI/{VERSION}/Mustang-CLI-{VERSION}.jar"


def herunterladen() -> None:
    if not JAR.exists():
        print(f"Lade Mustang {VERSION} herunter (ca. 60 MB, nur beim ersten Mal) ...")
        urllib.request.urlretrieve(URL, JAR)


def pruefen(pdf: Path) -> dict:
    """Gibt {"pdf": bool, "xml": bool, "gesamt": bool, "bericht": str} zurück."""
    herunterladen()
    ergebnis = subprocess.run(
        ["java", "-jar", str(JAR), "--no-notices", "--action", "validate", "--source", str(pdf)],
        capture_output=True,
        text=True,
        timeout=300,
    )
    bericht = ergebnis.stdout
    teile = {
        name: re.search(rf"<{name}>.*?<summary status=\"(\w+)\"", bericht, re.S)
        for name in ("pdf", "xml")
    }
    pdf_ok = bool(teile["pdf"]) and teile["pdf"][1] == "valid"
    xml_ok = bool(teile["xml"]) and teile["xml"][1] == "valid"
    # Achtung: Mustangs eigenes Gesamturteil ignoriert PDF/A-Fehler, darum selbst verknüpfen
    return {"pdf": pdf_ok, "xml": xml_ok, "gesamt": pdf_ok and xml_ok, "bericht": bericht}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    if not shutil.which("java"):
        print("Java ist nicht installiert. Download: https://adoptium.net (Temurin, Version 17 oder neuer)")
        sys.exit(2)
    e = pruefen(Path(sys.argv[1]))
    print(e["bericht"])
    print("PDF/A-3:", "gültig" if e["pdf"] else "UNGÜLTIG")
    print("XML (EN 16931):", "gültig" if e["xml"] else "UNGÜLTIG")
    print("Gesamt:", "GÜLTIG ✔" if e["gesamt"] else "UNGÜLTIG ✘")
    sys.exit(0 if e["gesamt"] else 1)
