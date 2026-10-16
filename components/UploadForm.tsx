"use client";

import { useRef, useState } from "react";
import type { Vehicle } from "@/lib/analysis-schema";
import { compressImage, MAX_UPLOAD_BYTES } from "@/lib/compress-image";
import { VehicleForm } from "./VehicleForm";

export function UploadForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (file: File, vehicle: Vehicle) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle>({});

  async function handleFile(selected: File | undefined) {
    setError("");
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!selected) return;

    if (selected.type === "application/pdf") {
      if (selected.size > MAX_UPLOAD_BYTES) {
        setError("Das PDF ist zu groß (max. 4 MB). Tipp: Fotografiere die Seiten stattdessen.");
        return;
      }
      setFile(selected);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Bitte lade ein Foto (JPG, PNG) oder ein PDF hoch.");
      return;
    }

    setPreparing(true);
    try {
      const compressed = await compressImage(selected);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setError("Das Bild konnte nicht gelesen werden. Bitte versuche es mit einem JPG oder PNG.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (file) onSubmit(file, vehicle);
      }}
    >
      <div className="space-y-3">
        <p className="font-semibold text-slate-900">Kostenvoranschlag oder Rechnung</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-brand-600 hover:bg-brand-50"
        >
          {preview ? (
            <img src={preview} alt="Vorschau des Dokuments" className="max-h-64 rounded-lg object-contain" />
          ) : file ? (
            <span className="text-4xl" aria-hidden>📄</span>
          ) : (
            <span className="text-4xl" aria-hidden>📷</span>
          )}
          <span className="font-medium text-brand-700">
            {preparing
              ? "Bild wird vorbereitet …"
              : file
                ? "Andere Datei wählen"
                : "Foto aufnehmen oder Datei wählen"}
          </span>
          <span className="text-sm text-slate-500">JPG, PNG oder PDF · PDF max. 4 MB</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {file && !preview && <p className="text-sm text-slate-600">Ausgewählt: PDF-Dokument</p>}
        {error && <p className="text-sm text-alert-700">{error}</p>}
        <p className="text-sm text-slate-500">
          Tipp: Fotografiere das Dokument gerade, gut beleuchtet und vollständig. Name, Adresse und
          Kennzeichen kannst du gern abdecken – sie werden nicht benötigt.
        </p>
      </div>

      <VehicleForm value={vehicle} onChange={setVehicle} />

      <button
        type="submit"
        disabled={!file || disabled || preparing}
        className="min-h-12 w-full rounded-lg bg-brand-700 px-6 text-lg font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Jetzt analysieren
      </button>
    </form>
  );
}
