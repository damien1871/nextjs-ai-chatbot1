import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Nimmt eine E-Mail-Adresse für die Warteliste entgegen und gibt sie an Brevo
 * weiter. Brevo verschickt dann automatisch eine Bestätigungs-Mail
 * (Double-Opt-in, in Deutschland Pflicht). Erst nach dem Klick auf den Link
 * landet die Adresse wirklich auf der Liste.
 *
 * Solange keine Brevo-Zugangsdaten eingetragen sind, läuft das Formular im
 * Testmodus: Die Anfrage wird angenommen, aber nirgendwo gespeichert.
 */

const BodySchema = z.object({
  email: z.email().max(254),
  // "Honigtopf"-Feld: für Menschen unsichtbar. Füllt es jemand aus, ist es ein Bot.
  website: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige E-Mail-Adresse ein." },
      { status: 400 },
    );
  }

  // Bot erkannt: Wir tun so, als hätte es geklappt, speichern aber nichts.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!apiKey || !listId || !templateId) {
    console.info("[warteliste] Testmodus: Brevo ist nicht konfiguriert, Adresse wird nicht gespeichert.");
    return NextResponse.json({ ok: true, testMode: true });
  }

  const response = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      email: parsed.data.email,
      includeListIds: [listId],
      templateId,
      redirectionUrl: `${siteUrl}/?warteliste=bestaetigt`,
    }),
  });

  if (!response.ok) {
    // Absichtlich ohne E-Mail-Adresse im Log (Datenschutz).
    console.error("[warteliste] Brevo-Fehler:", response.status, await response.text());
    return NextResponse.json(
      { error: "Die Anmeldung hat gerade nicht geklappt. Bitte versuche es später noch einmal." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
