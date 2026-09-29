#!/bin/sh
# Start für Mac und Linux:  ./start.sh
cd "$(dirname "$0")" || exit 1
if [ ! -x .venv/bin/python ]; then
  echo "Erster Start: Ich richte alles ein. Das dauert 1-2 Minuten ..."
  python3 -m venv .venv || exit 1
fi
.venv/bin/python -m pip install --quiet --disable-pip-version-check -r requirements.txt || exit 1
[ -f .env ] || cp .env.example .env
echo "Die App läuft: http://127.0.0.1:8000  (Beenden mit Strg+C)"
(sleep 2; command -v open >/dev/null && open http://127.0.0.1:8000 || xdg-open http://127.0.0.1:8000) >/dev/null 2>&1 &
exec .venv/bin/python -m uvicorn app.main:app --port 8000
