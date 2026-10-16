"use client";

import type { Vehicle } from "@/lib/analysis-schema";

const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

/** Optionale Fahrzeugangaben – machen die Preiseinschätzung genauer. */
export function VehicleForm({
  value,
  onChange,
}: {
  value: Vehicle;
  onChange: (vehicle: Vehicle) => void;
}) {
  const set = (key: keyof Vehicle) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [key]: event.target.value });

  return (
    <fieldset className="space-y-4">
      <legend className="font-semibold text-slate-900">
        Fahrzeugangaben <span className="font-normal text-slate-500">(optional)</span>
      </legend>
      <p className="text-sm text-slate-600">
        Mit diesen Angaben kann die Preiseinschätzung genauer ausfallen. Bitte kein Kennzeichen
        eingeben – das wird nicht benötigt.
      </p>

      <div className="flex gap-2" role="radiogroup" aria-label="Fahrzeugtyp">
        {(
          [
            ["auto", "🚗 Auto"],
            ["motorrad", "🏍️ Motorrad"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value.fahrzeugtyp === key}
            onClick={() => onChange({ ...value, fahrzeugtyp: value.fahrzeugtyp === key ? "" : key })}
            className={`min-h-11 flex-1 rounded-lg border px-3 font-medium ${
              value.fahrzeugtyp === key
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Marke</span>
          <input className={inputClass} maxLength={60} placeholder="z. B. VW" value={value.marke ?? ""} onChange={set("marke")} />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span>Modell</span>
          <input className={inputClass} maxLength={60} placeholder="z. B. Golf VII 1.4 TSI" value={value.modell ?? ""} onChange={set("modell")} />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span>Baujahr</span>
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={4}
            placeholder="z. B. 2016"
            value={value.baujahr ?? ""}
            onChange={(e) => onChange({ ...value, baujahr: e.target.value.replace(/\D/g, "") })}
          />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span>Kilometerstand</span>
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={9}
            placeholder="z. B. 120000"
            value={value.kilometerstand ?? ""}
            onChange={(e) => onChange({ ...value, kilometerstand: e.target.value.replace(/\D/g, "") })}
          />
        </label>
      </div>
    </fieldset>
  );
}
