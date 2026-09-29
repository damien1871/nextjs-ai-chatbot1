// Kleine Helfer für das Formular: Positionen hinzufügen/löschen und Summen live nachrechnen.
// Die verbindliche Prüfung passiert trotzdem auf dem Server.

const zeilen = document.getElementById("zeilen");
const kleinunternehmer = document.getElementById("kleinunternehmer");

function zahl(text) {
  let t = String(text || "").replace(/[€%\s]/g, "").replace("EUR", "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) {
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else {
    t = t.replace(",", ".");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Rechnet in Cent, damit keine Rundungsfehler entstehen
const cent = (betrag) => Math.round(betrag * 100);
const euro = (c) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function nummerieren() {
  [...zeilen.rows].forEach((zeile, i) => {
    zeile.querySelectorAll("input, select").forEach((el) => {
      const feld = el.dataset.feld || el.name.replace(/^pos-\d+-/, "");
      el.dataset.feld = feld;
      el.name = `pos-${i}-${feld}`;
    });
  });
}

function nachrechnen() {
  const gruppen = {};
  let netto = 0;
  for (const zeile of zeilen.rows) {
    const wert = (feld) => zeile.querySelector(`[data-feld="${feld}"]`).value;
    const betrag = cent((zahl(wert("menge")) || 0) * (zahl(wert("einzelpreis")) || 0));
    const satz = kleinunternehmer.checked ? 0 : zahl(wert("steuersatz")) || 0;
    gruppen[satz] = (gruppen[satz] || 0) + betrag;
    netto += betrag;
  }
  let steuer = 0;
  for (const [satz, basis] of Object.entries(gruppen)) steuer += Math.round((basis * Number(satz)) / 100);
  document.getElementById("calc-netto").textContent = euro(netto);
  document.getElementById("calc-steuer").textContent = euro(steuer);
  document.getElementById("calc-brutto").textContent = euro(netto + steuer);
  document.querySelectorAll(".spalte-steuer").forEach((el) => (el.style.display = kleinunternehmer.checked ? "none" : ""));
}

document.getElementById("neue-zeile").addEventListener("click", () => {
  zeilen.append(document.getElementById("zeilen-vorlage").content.cloneNode(true));
  nummerieren();
  nachrechnen();
  zeilen.rows[zeilen.rows.length - 1].querySelector("input").focus();
});

zeilen.addEventListener("click", (e) => {
  if (e.target.closest(".entfernen")) {
    e.target.closest("tr").remove();
    nummerieren();
    nachrechnen();
  }
});

document.getElementById("formular").addEventListener("input", nachrechnen);
document.getElementById("formular").addEventListener("change", nachrechnen);
document.getElementById("knopf-erstellen").addEventListener("click", () => {
  document.getElementById("download-hinweis").hidden = false;
});

nummerieren();
nachrechnen();
