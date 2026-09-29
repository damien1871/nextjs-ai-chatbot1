@echo off
chcp 65001 > nul
cd /d "%~dp0"
title E-Rechnung aus PDF

where py > nul 2>&1
if errorlevel 1 (
  echo.
  echo  Python wurde nicht gefunden.
  echo  Bitte installiere Python von https://www.python.org/downloads/
  echo  und setze beim Installieren das Haekchen bei "Add python.exe to PATH".
  echo.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo  Erster Start: Ich richte alles ein. Das dauert 1-2 Minuten ...
  py -3 -m venv .venv || goto fehler
)

".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r requirements.txt || goto fehler

if not exist ".env" copy ".env.example" ".env" > nul

echo.
echo  Die App laeuft. Dein Browser oeffnet sich gleich.
echo  Falls nicht: http://127.0.0.1:8000 im Browser eingeben.
echo  Zum Beenden dieses Fenster schliessen.
echo.
start "" http://127.0.0.1:8000
".venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
pause
exit /b 0

:fehler
echo.
echo  Beim Einrichten ist ein Fehler aufgetreten. Bitte schick mir den Text oben.
pause
exit /b 1
