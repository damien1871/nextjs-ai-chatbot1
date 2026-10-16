/**
 * Gut sichtbarer Hinweis: keine Rechtsberatung, kein Gutachten.
 * Wird auf der Landingpage, über dem Upload und über jedem Ergebnis angezeigt.
 */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      className={`rounded-xl border border-warn-700/30 bg-warn-50 p-4 text-sm text-slate-800 ${className}`}
    >
      <p className="font-semibold text-warn-700">Wichtiger Hinweis</p>
      <p className="mt-1">
        Werkstatt-Check ist eine <strong>Orientierungshilfe</strong>, die mit künstlicher Intelligenz
        arbeitet. Sie ersetzt <strong>keine Rechtsberatung</strong>, <strong>kein Gutachten</strong>{" "}
        und keine Prüfung des Fahrzeugs durch eine Fachwerkstatt. Preisangaben sind grobe
        Schätzungen; regionale Preise schwanken stark. Die KI kann sich irren – sprich offene Punkte
        immer direkt mit deiner Werkstatt ab.
      </p>
    </div>
  );
}
