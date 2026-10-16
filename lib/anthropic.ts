import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type Analysis, AnalysisSchema, type Vehicle } from "./analysis-schema";

/**
 * Hier passiert der eigentliche Aufruf der Anthropic API.
 * Diese Datei läuft NUR auf dem Server – der API-Key kommt nie in den Browser.
 */

// Aktuelles Modell laut offizieller Doku (platform.claude.com → Models overview).
// Über die Umgebungsvariable ANTHROPIC_MODEL kannst du es ohne Code-Änderung wechseln.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export type UploadMediaType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** Eigener Fehler mit einer Meldung, die man dem Nutzer zeigen kann. */
export class AnalysisError extends Error {
  constructor(
    public userMessage: string,
    public status = 500,
  ) {
    super(userMessage);
  }
}

// Das Ausgabeformat als JSON-Schema (wird aus lib/analysis-schema.ts erzeugt).
const { $schema: _unused, ...OUTPUT_JSON_SCHEMA } = z.toJSONSchema(AnalysisSchema);

let cachedPrompt: string | null = null;

/** Lädt den System-Prompt aus lib/prompts/analyse-system-prompt.md. */
async function loadSystemPrompt(): Promise<string> {
  // Im Entwicklungsmodus jedes Mal neu lesen, damit Änderungen sofort wirken.
  if (cachedPrompt && process.env.NODE_ENV === "production") return cachedPrompt;
  const file = path.join(process.cwd(), "lib", "prompts", "analyse-system-prompt.md");
  const raw = await readFile(file, "utf8");
  // HTML-Kommentare (<!-- ... -->) sind Notizen für dich und gehen nicht an die KI.
  cachedPrompt = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  return cachedPrompt;
}

function describeVehicle(vehicle: Vehicle): string {
  const lines = [
    vehicle.fahrzeugtyp && `Fahrzeugtyp: ${vehicle.fahrzeugtyp === "auto" ? "Auto" : "Motorrad"}`,
    vehicle.marke && `Marke: ${vehicle.marke}`,
    vehicle.modell && `Modell: ${vehicle.modell}`,
    vehicle.baujahr && `Baujahr: ${vehicle.baujahr}`,
    vehicle.kilometerstand && `Kilometerstand: ${vehicle.kilometerstand} km`,
  ].filter(Boolean);
  return lines.length > 0
    ? `Angaben des Nutzers zum Fahrzeug:\n${lines.join("\n")}`
    : "Der Nutzer hat keine Fahrzeugangaben gemacht.";
}

let client: Anthropic | null = null;

export async function analyseDocument(params: {
  data: Buffer;
  mediaType: UploadMediaType;
  vehicle: Vehicle;
}): Promise<Analysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnalysisError(
      "Die Analyse ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt).",
      503,
    );
  }
  client ??= new Anthropic();

  const base64 = params.data.toString("base64");
  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    params.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: params.mediaType, data: base64 } };

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Falls die Sicherheitsfilter eine Anfrage fälschlich ablehnen, versucht
      // die API es automatisch mit einem passenden Ersatzmodell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // "medium" = guter Kompromiss aus Gründlichkeit, Dauer und Kosten.
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA },
      },
      // Der System-Prompt ist bei jeder Anfrage gleich und wird daher
      // zwischengespeichert (Prompt Caching) – das spart Kosten.
      system: [{ type: "text", text: await loadSystemPrompt(), cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: `${describeVehicle(params.vehicle)}\n\nBitte analysiere das Dokument.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new AnalysisError(
        "Dieses Dokument konnte leider nicht analysiert werden. Bitte versuche es mit einem anderen Foto.",
        422,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new AnalysisError(
        "Das Dokument ist zu umfangreich für eine Analyse. Versuche es mit einzelnen Seiten.",
        422,
      );
    }

    // Die Antwort kann mehrere Blöcke enthalten (z. B. "thinking"); wir brauchen den Text-Block.
    const text = response.content.find((block) => block.type === "text")?.text;
    const parsed = text ? AnalysisSchema.safeParse(safeJsonParse(text)) : null;
    if (!parsed?.success) {
      console.error("[analyse] Antwort passt nicht zum Schema");
      throw new AnalysisError("Die Antwort der KI war unvollständig. Bitte versuche es erneut.", 502);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (error instanceof Anthropic.RateLimitError) {
      throw new AnalysisError("Gerade sind sehr viele Anfragen unterwegs. Bitte versuche es in einer Minute erneut.", 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[analyse] API-Key ungültig");
      throw new AnalysisError("Die Analyse ist falsch eingerichtet (API-Key ungültig).", 503);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("[analyse] Anfrage abgelehnt:", error.message);
      throw new AnalysisError(
        "Die Datei konnte nicht verarbeitet werden. Ist sie vielleicht beschädigt oder passwortgeschützt?",
        400,
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[analyse] API-Fehler:", error.status, error.message);
      throw new AnalysisError("Der Analysedienst ist gerade nicht erreichbar. Bitte versuche es später erneut.", 502);
    }
    console.error("[analyse] Unerwarteter Fehler:", error);
    throw new AnalysisError("Bei der Analyse ist ein Fehler aufgetreten. Bitte versuche es erneut.", 500);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
