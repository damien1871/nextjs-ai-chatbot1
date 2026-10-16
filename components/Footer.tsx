import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Werkstatt-Check ist eine Orientierungshilfe – keine Rechtsberatung und kein Gutachten.
        </p>
        <nav className="flex gap-4">
          <Link href="/impressum" className="hover:text-slate-900">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-slate-900">
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}
