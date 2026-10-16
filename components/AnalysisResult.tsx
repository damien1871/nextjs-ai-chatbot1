"use client";

import { useState } from "react";
import type { Analysis, Position } from "@/lib/analysis-schema";
import { Disclaimer } from "./Disclaimer";

/* ---------- Beschriftungen und Farben ---------- */

const EINSTUFUNG = {
  notwendig: { label: "Notwendig", className: "bg-ok-50 text-ok-700 border-ok-700/30" },
  empfohlen: { label: "Empfohlen, nicht dringend", className: "bg-warn-50 text-warn-700 border-warn-700/30" },
  fraglich: { label: "Fraglich – nachfragen", className: "bg-alert-50 text-alert-700 border-alert-700/30" },
} as const;

const PREIS = {
  guenstig: { label: "eher günstig", className: "text-ok-700" },
  ueblich: { label: "im üblichen Rahmen", className: "text-slate-700" },
  auffaellig_hoch: { label: "auffällig hoch", className: "text-alert-700" },
  nicht_beurteilbar: { label: "nicht beurteilbar", className: "text-slate-500" },
} as const;

const KATEGORIE = {
  teil: "Ersatzteil",
  arbeitszeit: "Arbeitszeit",
  kleinmaterial: "Kleinmaterial",
  entsorgung: "Entsorgung",
  pruefung_diagnose: "Prüfung / Diagnose",
  sonstiges: "Sonstiges",
} as const;

const DOKUMENTART = {
  kostenvoranschlag: "Kostenvoranschlag",
  rechnung: "Rechnung",
  unklar: "Werkstattdokument",
  kein_werkstattdokument: "Kein Werkstattdokument",
} as const;

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/* ---------- Hauptkomponente ---------- */

export function AnalysisResult({ analysis, onReset }: { analysis: Analysis; onReset: () => void }) {
  const { dokument, positionen } = analysis;

  if (dokument.art === "kein_werkstattdokument") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">Kein Kostenvoranschlag erkannt</h2>
          <p className="mt-2 text-slate-700">{analysis.zusammenfassung}</p>
        </div>
        <ResetButton onReset={onReset} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Disclaimer />

      {/* Kopf: Dokumentart und Lesbarkeit */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
          {DOKUMENTART[dokument.art]}
          {analysis.fahrzeug_erkannt && ` · ${analysis.fahrzeug_erkannt}`}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Zusammenfassung</h2>
        <p className="mt-3 leading-relaxed text-slate-800">{analysis.zusammenfassung}</p>
        {dokument.lesbarkeit !== "gut" && (
          <p className="mt-4 rounded-lg bg-warn-50 p-3 text-sm text-warn-700">
            <strong>Hinweis zur Lesbarkeit:</strong>{" "}
            {dokument.lesbarkeit_hinweis ??
              "Das Dokument war nur teilweise lesbar. Einzelne Angaben können fehlen oder ungenau sein."}
          </p>
        )}
      </section>

      <Overview analysis={analysis} />

      {/* Positionen */}
      <section>
        <h2 className="text-xl font-bold text-slate-900">Alle Positionen ({positionen.length})</h2>
        <p className="mt-1 text-sm text-slate-600">
          Preiseinschätzungen sind grobe Schätzungen. Regionale Preise und Stundensätze schwanken
          stark.
        </p>
        <ul className="mt-4 space-y-3">
          {positionen.map((position, index) => (
            <PositionCard key={index} position={position} />
          ))}
        </ul>
      </section>

      <Questions questions={analysis.fragen_an_werkstatt} />

      {analysis.hinweise.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-slate-900">Weitere Hinweise</h2>
          <ul className="mt-2 space-y-1 text-slate-700">
            {analysis.hinweise.map((hinweis, index) => (
              <li key={index} className="ml-5 list-disc">
                {hinweis}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResetButton onReset={onReset} />
    </div>
  );
}

/* ---------- Übersicht: Summen je Einstufung ---------- */

function Overview({ analysis }: { analysis: Analysis }) {
  const { positionen, dokument } = analysis;
  // Sind die Einzelbeträge netto, rechnen wir für die Übersicht 19 % MwSt. dazu.
  const factor = dokument.positionsbetraege_sind === "netto" ? 1.19 : 1;
  const totals = (["notwendig", "empfohlen", "fraglich"] as const).map((stufe) => {
    const items = positionen.filter((p) => p.einstufung === stufe);
    const sum = items.reduce((acc, p) => acc + (p.betrag_euro ?? 0), 0) * factor;
    const missing = items.some((p) => p.betrag_euro === null);
    return { stufe, count: items.length, sum, missing };
  });

  const vatNote =
    dokument.positionsbetraege_sind === "netto"
      ? "Beträge inkl. 19 % MwSt. (aus den Netto-Positionen umgerechnet)."
      : dokument.positionsbetraege_sind === "brutto"
        ? "Beträge inkl. MwSt. laut Dokument."
        : "Ob die Positionen netto oder brutto sind, war nicht erkennbar – Beträge wie auf dem Dokument.";

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900">Auf einen Blick</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {totals.map(({ stufe, count, sum, missing }) => (
          <div key={stufe} className={`rounded-xl border p-4 ${EINSTUFUNG[stufe].className}`}>
            <p className="text-sm font-semibold">{EINSTUFUNG[stufe].label}</p>
            <p className="mt-1 text-2xl font-bold">{count > 0 ? `ca. ${euro.format(sum)}` : "–"}</p>
            <p className="text-sm opacity-80">
              {count} {count === 1 ? "Position" : "Positionen"}
              {missing && " · nicht alle Beträge lesbar"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {vatNote}
        {dokument.gesamtbetrag_brutto_euro !== null &&
          ` Gesamtbetrag laut Dokument: ${euro.format(dokument.gesamtbetrag_brutto_euro)}.`}
      </p>
    </section>
  );
}

/* ---------- Eine Position ---------- */

function PositionCard({ position }: { position: Position }) {
  const einstufung = EINSTUFUNG[position.einstufung];
  const preis = PREIS[position.preis_einschaetzung];

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {KATEGORIE[position.kategorie]}
            {position.menge && ` · ${position.menge}`}
          </p>
          <h3 className="mt-0.5 break-words font-semibold text-slate-900">{position.bezeichnung}</h3>
        </div>
        <p className="font-semibold text-slate-900">
          {position.betrag_euro !== null ? euro.format(position.betrag_euro) : "Betrag unleserlich"}
        </p>
      </div>

      <p className="mt-2 text-slate-700">{position.erklaerung}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-sm font-medium ${einstufung.className}`}>
          {einstufung.label}
        </span>
        {position.sicherheitsrelevant && (
          <span className="rounded-full border border-brand-600/30 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            Sicherheitsrelevant
          </span>
        )}
        {position.unsicher && (
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-600">
            Unsicher gelesen
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-700">
        <strong>Warum?</strong> {position.einstufung_begruendung}
      </p>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p>
          <span className="text-slate-500">Preis (Schätzung): </span>
          <strong className={preis.className}>{preis.label}</strong>
          {position.preis_spanne && <span className="text-slate-600"> · üblich {position.preis_spanne}</span>}
        </p>
        <p className="mt-1 text-slate-600">{position.preis_begruendung}</p>
      </div>
    </li>
  );
}

/* ---------- Fragen an die Werkstatt ---------- */

function Questions({ questions }: { questions: Analysis["fragen_an_werkstatt"] }) {
  const [copied, setCopied] = useState(false);
  if (questions.length === 0) return null;

  async function copy() {
    const text = questions.map((q, i) => `${i + 1}. ${q.frage}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage nicht verfügbar – dann eben nicht.
    }
  }

  return (
    <section className="rounded-xl border border-brand-600/20 bg-brand-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-brand-900">Fragen an deine Werkstatt</h2>
        <button
          type="button"
          onClick={copy}
          className="min-h-10 rounded-lg border border-brand-600/30 bg-white px-3 text-sm font-medium text-brand-700"
        >
          {copied ? "Kopiert ✓" : "Fragen kopieren"}
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {questions.map((question, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
              {index + 1}
            </span>
            <div>
              <p className="text-slate-900">{question.frage}</p>
              {question.bezug && <p className="text-sm text-slate-500">Bezug: {question.bezug}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800 hover:bg-slate-50"
    >
      Neues Dokument prüfen
    </button>
  );
}
