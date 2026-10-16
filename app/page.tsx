import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { WaitlistForm } from "@/components/WaitlistForm";

const features = [
  {
    title: "Alle Positionen verständlich",
    text: "Teile, Arbeitszeit, Kleinmaterial, Entsorgung – sauber aufgelistet und in einfacher Sprache erklärt.",
  },
  {
    title: "Was ist wirklich dringend?",
    text: "Jede Position wird eingestuft: notwendig, empfohlen aber nicht dringend, oder fraglich – nachfragen.",
  },
  {
    title: "Preis-Plausibilität",
    text: "Eine grobe Einordnung (günstig, üblich, auffällig hoch) – immer klar als Schätzung gekennzeichnet und begründet.",
  },
  {
    title: "Die richtigen Fragen",
    text: "Konkrete Fragen, die du der Werkstatt stellen kannst – sachlich und auf Augenhöhe.",
  },
];

const steps = [
  {
    title: "Foto machen",
    text: "Fotografiere den Kostenvoranschlag oder die Rechnung – oder lade ein PDF hoch.",
  },
  {
    title: "Fahrzeug angeben (optional)",
    text: "Auto oder Motorrad, Marke, Modell, Baujahr, Kilometerstand – das macht die Einschätzung genauer.",
  },
  {
    title: "Einschätzung lesen",
    text: "Nach etwa einer Minute siehst du alle Positionen, Einstufungen, Preis-Hinweise und Fragen.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ warteliste?: string }>;
}) {
  const { warteliste } = await searchParams;

  return (
    <>
      {warteliste === "bestaetigt" && (
        <div className="bg-ok-50 px-4 py-3 text-center text-sm font-medium text-ok-700">
          Danke! Deine E-Mail-Adresse ist bestätigt – du stehst jetzt auf der Warteliste.
        </div>
      )}

      {/* Hero: das Problem */}
      <section className="bg-gradient-to-b from-brand-50 to-transparent">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-20">
          <p className="inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
            Für Auto- und Motorradfahrer in Deutschland
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-brand-900 sm:text-5xl">
            „Die Werkstatt wollte 900 €.
            <br />
            Nötig waren 340 €.“
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-700">
            Kostenvoranschläge sind oft schwer zu verstehen: Fachbegriffe, Kürzel, Pauschalen. Was
            ist wirklich nötig, was kann warten, und ist der Preis im üblichen Rahmen?
            Werkstatt-Check übersetzt deinen Kostenvoranschlag in verständliche Sprache – damit du
            gut informiert mit deiner Werkstatt sprechen kannst.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="flex min-h-12 items-center justify-center rounded-lg bg-brand-700 px-6 font-semibold text-white hover:bg-brand-900"
            >
              Demo kostenlos testen
            </Link>
            <a
              href="#warteliste"
              className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Auf die Warteliste
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Beispielhafte Darstellung. Die meisten Werkstätten arbeiten fair – Werkstatt-Check hilft
            dir, die Positionen zu verstehen und gezielt nachzufragen.
          </p>
        </div>
      </section>

      {/* Was du bekommst */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold text-brand-900">Was du bekommst</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1 text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-ok-50 px-3 py-1 font-medium text-ok-700">notwendig</span>
          <span className="rounded-full bg-warn-50 px-3 py-1 font-medium text-warn-700">
            empfohlen, nicht dringend
          </span>
          <span className="rounded-full bg-alert-50 px-3 py-1 font-medium text-alert-700">
            fraglich – nachfragen
          </span>
        </div>
      </section>

      {/* So funktioniert's */}
      <section id="so-gehts" className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold text-brand-900">So funktioniert&apos;s</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Deine Daten bleiben bei dir</p>
            <p className="mt-1">
              Hochgeladene Dateien werden nur für die Analyse verwendet und danach sofort verworfen
              – wir speichern sie nicht. Name, Adresse und Kennzeichen auf dem Dokument werden nicht
              weiterverwendet. Du kannst sie vor dem Hochladen auch einfach abdecken.
            </p>
          </div>
        </div>
      </section>

      {/* Warteliste */}
      <section id="warteliste" className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl bg-brand-900 p-6 text-white sm:p-10">
          <h2 className="text-2xl font-bold">Sei dabei, wenn es losgeht</h2>
          <p className="mt-2 max-w-xl text-brand-100">
            Werkstatt-Check ist noch in der Testphase. Trag dich ein und wir melden uns, sobald die
            vollständige Version verfügbar ist.
          </p>
          <div className="mt-6 max-w-xl rounded-xl bg-white p-4 text-slate-900">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <Disclaimer />
      </section>
    </>
  );
}
