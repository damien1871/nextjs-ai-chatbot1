"use client";

import { useEffect, useState } from "react";
import { AnalysisResult } from "@/components/AnalysisResult";
import { Disclaimer } from "@/components/Disclaimer";
import { UploadForm } from "@/components/UploadForm";
import type { Analysis, Vehicle } from "@/lib/analysis-schema";
import { sampleAnalysis } from "@/lib/sample-analysis";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; analysis: Analysis };

const LOADING_STEPS = [
  "Dokument wird gelesen …",
  "Positionen werden erfasst …",
  "Einstufung und Preise werden geprüft …",
  "Fragen an die Werkstatt werden formuliert …",
  "Fast fertig …",
];

export function DemoClient() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function analyse(file: File, vehicle: Vehicle) {
    setState({ status: "loading" });
    const body = new FormData();
    body.append("file", file);
    for (const [key, value] of Object.entries(vehicle)) {
      if (value) body.append(key, value);
    }
    try {
      const response = await fetch("/api/analyse", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Die Analyse ist fehlgeschlagen. Bitte versuche es erneut.");
      }
      setState({ status: "done", analysis: data.analysis });
    } catch (error) {
      const message =
        error instanceof TypeError
          ? "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung."
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler";
      setState({ status: "error", message });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const reset = () => {
    setState({ status: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (state.status === "done") {
    return <AnalysisResult analysis={state.analysis} onReset={reset} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-900">Kostenvoranschlag prüfen</h1>
        <p className="mt-2 text-slate-700">
          Lade ein Foto oder PDF deines Kostenvoranschlags oder deiner Werkstattrechnung hoch. Du
          bekommst eine verständliche Einschätzung – meist in etwa einer Minute.
        </p>
      </div>

      <Disclaimer />

      {state.status === "loading" ? (
        <LoadingIndicator />
      ) : (
        <>
          {state.status === "error" && (
            <div role="alert" className="rounded-xl border border-alert-700/30 bg-alert-50 p-4 text-alert-700">
              {state.message}
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
            <UploadForm onSubmit={analyse} disabled={false} />
          </div>
          <p className="text-center text-sm text-slate-600">
            Erst mal nur schauen?{" "}
            <button
              type="button"
              onClick={() => setState({ status: "done", analysis: sampleAnalysis })}
              className="font-medium text-brand-700 underline"
            >
              Beispiel-Ergebnis ansehen
            </button>
          </p>
          <p className="text-center text-xs text-slate-500">
            Deine Datei wird nur für die Analyse verwendet und danach sofort verworfen.
          </p>
        </>
      )}
    </div>
  );
}

function LoadingIndicator() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 12000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center" aria-live="polite">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
      <p className="font-semibold text-slate-900">{LOADING_STEPS[step]}</p>
      <p className="text-sm text-slate-500">Das dauert meist 30–90 Sekunden. Bitte lass die Seite geöffnet.</p>
    </div>
  );
}
