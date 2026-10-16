import { NextResponse } from "next/server";
import { VehicleSchema } from "@/lib/analysis-schema";
import { AnalysisError, analyseDocument, type UploadMediaType } from "@/lib/anthropic";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Nimmt eine hochgeladene Datei entgegen, lässt sie von Claude analysieren und
 * gibt das Ergebnis als JSON zurück.
 *
 * Datenschutz: Die Datei wird ausschließlich im Arbeitsspeicher verarbeitet.
 * Sie wird weder auf die Festplatte geschrieben noch in einer Datenbank
 * gespeichert und ist nach dem Ende dieser Funktion verworfen. Dateiinhalte
 * und Analyseergebnisse werden nicht geloggt.
 */

export const runtime = "nodejs";
// Eine Analyse dauert meist 30–90 Sekunden. So lange darf die Funktion laufen.
export const maxDuration = 180;

// Vercel erlaubt max. 4,5 MB pro Anfrage; wir bleiben mit 4 MB darunter.
const MAX_BYTES = 4 * 1024 * 1024;

/** Erkennt den Dateityp anhand der ersten Bytes (nicht nur anhand des Namens). */
function detectMediaType(bytes: Buffer): UploadMediaType | null {
  if (bytes.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(getClientIp(request));
  if (!rate.allowed) {
    return errorResponse(
      `Du hast das Limit für Test-Analysen erreicht. Bitte versuche es in etwa ${rate.retryAfterMinutes} Minuten erneut.`,
      429,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Die Datei ist zu groß oder konnte nicht gelesen werden (max. 4 MB).", 413);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Bitte wähle eine Datei aus.", 400);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse("Die Datei ist zu groß (max. 4 MB).", 413);
  }

  const vehicle = VehicleSchema.safeParse({
    fahrzeugtyp: form.get("fahrzeugtyp") ?? undefined,
    marke: form.get("marke") ?? undefined,
    modell: form.get("modell") ?? undefined,
    baujahr: form.get("baujahr") ?? undefined,
    kilometerstand: form.get("kilometerstand") ?? undefined,
  });
  if (!vehicle.success) {
    return errorResponse("Die Fahrzeugangaben sind ungültig.", 400);
  }

  const data = Buffer.from(await file.arrayBuffer());
  const mediaType = detectMediaType(data);
  if (!mediaType) {
    return errorResponse("Dieser Dateityp wird nicht unterstützt. Erlaubt sind JPG, PNG und PDF.", 415);
  }

  try {
    const analysis = await analyseDocument({ data, mediaType, vehicle: vehicle.data });
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof AnalysisError) return errorResponse(error.userMessage, error.status);
    return errorResponse("Bei der Analyse ist ein Fehler aufgetreten.", 500);
  } finally {
    // Puffer leeren – die Datei existiert danach nirgends mehr.
    data.fill(0);
  }
}
