import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Impressum – Werkstatt-Check" };

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          [Vorname Nachname]
          <br />
          [Straße Hausnummer]
          <br />
          [PLZ Ort]
        </p>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail: [kontakt@deine-domain.de]
          <br />
          Telefon: [optional]
        </p>
      </section>
      <section>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>[Vorname Nachname, Anschrift wie oben]</p>
      </section>
      <section>
        <h2>Hinweis</h2>
        <p>
          Die Inhalte und Analysen auf dieser Website dienen ausschließlich der allgemeinen
          Orientierung. Sie stellen keine Rechtsberatung und kein Sachverständigengutachten dar.
        </p>
      </section>
    </LegalPage>
  );
}
