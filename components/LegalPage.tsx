/** Einheitlicher Rahmen für Impressum und Datenschutzerklärung. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-900">{title}</h1>
      <div className="mt-4 rounded-xl border border-alert-700/30 bg-alert-50 p-4 text-sm text-alert-700">
        <strong>Platzhalter:</strong> Diese Seite ist noch nicht rechtsgültig. Ersetze alle Angaben in
        [eckigen Klammern] und lass den Text vor dem Livegang prüfen (z. B. mit einem
        Rechtstexte-Generator oder einer Anwältin / einem Anwalt).
      </div>
      <div className="mt-8 space-y-6 leading-relaxed text-slate-800 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
