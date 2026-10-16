import { z } from "zod";

/**
 * So muss das Ergebnis der KI aussehen.
 *
 * Diese Beschreibung wird zweimal benutzt:
 * 1. Sie wird an die Anthropic API geschickt ("Structured Outputs"). Claude kann
 *    dadurch technisch nur JSON in genau diesem Format zurückgeben.
 * 2. Die App prüft die Antwort damit noch einmal, bevor sie angezeigt wird.
 *
 * Wenn du hier ein Feld änderst, passe auch den System-Prompt
 * (lib/prompts/analyse-system-prompt.md) und die Anzeige
 * (components/AnalysisResult.tsx) an.
 */

export const Einstufung = z.enum(["notwendig", "empfohlen", "fraglich"]);
export const PreisEinschaetzung = z.enum([
  "guenstig",
  "ueblich",
  "auffaellig_hoch",
  "nicht_beurteilbar",
]);
export const Kategorie = z.enum([
  "teil",
  "arbeitszeit",
  "kleinmaterial",
  "entsorgung",
  "pruefung_diagnose",
  "sonstiges",
]);

export const PositionSchema = z.object({
  bezeichnung: z.string().describe("Bezeichnung wie auf dem Dokument, ggf. leicht bereinigt"),
  erklaerung: z.string().describe("Was ist das? In einfacher Sprache, 1–2 Sätze"),
  kategorie: Kategorie,
  menge: z.string().nullable().describe("Menge/Einheit wie auf dem Dokument, z. B. '1,5 Std.' oder '4 l'"),
  betrag_euro: z.number().nullable().describe("Gesamtbetrag der Position laut Dokument; null wenn nicht lesbar"),
  einstufung: Einstufung,
  einstufung_begruendung: z.string(),
  sicherheitsrelevant: z.boolean().describe("Bremsen, Reifen, Lenkung, Fahrwerk, Beleuchtung usw."),
  preis_einschaetzung: PreisEinschaetzung,
  preis_spanne: z.string().nullable().describe("Grobe übliche Spanne als Text, z. B. 'ca. 80–150 €'"),
  preis_begruendung: z.string(),
  unsicher: z.boolean().describe("true, wenn die Position schlecht lesbar oder unklar ist"),
});

export const AnalysisSchema = z.object({
  dokument: z.object({
    art: z.enum(["kostenvoranschlag", "rechnung", "unklar", "kein_werkstattdokument"]),
    lesbarkeit: z.enum(["gut", "teilweise", "schlecht"]),
    lesbarkeit_hinweis: z.string().nullable(),
    positionsbetraege_sind: z.enum(["netto", "brutto", "unklar"]),
    gesamtbetrag_brutto_euro: z.number().nullable(),
  }),
  fahrzeug_erkannt: z
    .string()
    .nullable()
    .describe("Fahrzeugtyp/Marke/Modell, falls erkennbar – niemals Kennzeichen oder FIN"),
  positionen: z.array(PositionSchema),
  fragen_an_werkstatt: z.array(
    z.object({
      frage: z.string(),
      bezug: z.string().nullable().describe("Auf welche Position sich die Frage bezieht"),
    }),
  ),
  hinweise: z.array(z.string()).describe("Unklarheiten, Lesefehler, fehlende Angaben"),
  zusammenfassung: z.string().describe("3–6 Sätze in einfacher Sprache"),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Position = z.infer<typeof PositionSchema>;

/** Optionale Fahrzeugangaben aus dem Formular. */
export const VehicleSchema = z.object({
  fahrzeugtyp: z.enum(["auto", "motorrad", ""]).optional(),
  marke: z.string().max(60).optional(),
  modell: z.string().max(60).optional(),
  baujahr: z.string().max(4).optional(),
  kilometerstand: z.string().max(9).optional(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;
