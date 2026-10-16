import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
            ✓
          </span>
          Werkstatt-Check
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/#so-gehts" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
            So funktioniert&apos;s
          </Link>
          <Link
            href="/demo"
            className="rounded-lg bg-brand-700 px-3 py-2 font-medium text-white hover:bg-brand-900"
          >
            Demo testen
          </Link>
        </nav>
      </div>
    </header>
  );
}
