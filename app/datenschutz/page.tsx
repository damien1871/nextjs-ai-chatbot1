import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Datenschutzerklärung – Werkstatt-Check" };

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <section>
        <h2>1. Verantwortliche Stelle</h2>
        <p>[Vorname Nachname, Anschrift, E-Mail – wie im Impressum]</p>
      </section>

      <section>
        <h2>2. Hosting</h2>
        <p>
          Diese Website wird bei [Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA]
          gehostet. Beim Aufruf werden technisch notwendige Daten (z. B. IP-Adresse, Zeitpunkt,
          aufgerufene Seite) verarbeitet. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          [Angaben zum Auftragsverarbeitungsvertrag und Drittlandtransfer ergänzen.]
        </p>
      </section>

      <section>
        <h2>3. Analyse von Kostenvoranschlägen und Rechnungen</h2>
        <p>
          Wenn du eine Datei hochlädst, wird sie verschlüsselt an unseren Server übertragen und zur
          Auswertung an die Anthropic API weitergeleitet ([Anthropic PBC, USA]).
        </p>
        <ul>
          <li>Die Datei wird nur im Arbeitsspeicher verarbeitet und nicht dauerhaft gespeichert.</li>
          <li>Nach der Analyse wird sie sofort verworfen; wir legen keine Kopie ab.</li>
          <li>
            Persönliche Angaben auf dem Dokument (Name, Adresse, Kennzeichen, Fahrgestellnummer)
            werden nicht weiterverwendet und nicht in das Ergebnis übernommen.
          </li>
          <li>
            [Angaben zur Speicherdauer bei Anthropic, zum Auftragsverarbeitungsvertrag und zum
            Drittlandtransfer ergänzen.]
          </li>
        </ul>
        <p>
          Tipp: Du kannst persönliche Daten vor dem Hochladen schwärzen oder abdecken – für die
          Analyse werden sie nicht benötigt.
        </p>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung des von dir angefragten Dienstes).</p>
      </section>

      <section>
        <h2>4. Warteliste / Newsletter</h2>
        <p>
          Wenn du dich für die Warteliste einträgst, speichern wir deine E-Mail-Adresse beim
          Newsletter-Dienst [Brevo, Sendinblue GmbH, Köpenicker Str. 126, 10179 Berlin]. Die
          Anmeldung erfolgt im Double-Opt-in-Verfahren: Erst nach Klick auf den Bestätigungslink
          wirst du eingetragen. Du kannst dich jederzeit abmelden. Rechtsgrundlage: Art. 6 Abs. 1
          lit. a DSGVO (Einwilligung).
        </p>
      </section>

      <section>
        <h2>5. Missbrauchsschutz</h2>
        <p>
          Um Missbrauch der Demo zu verhindern, zählen wir kurzzeitig die Anzahl der Analysen pro
          IP-Adresse. Diese Zählung liegt nur im Arbeitsspeicher und wird spätestens nach einer
          Stunde gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </section>

      <section>
        <h2>6. Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer
          Datenschutz-Aufsichtsbehörde.
        </p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>Diese Website setzt keine Tracking- oder Marketing-Cookies.</p>
      </section>
    </LegalPage>
  );
}
