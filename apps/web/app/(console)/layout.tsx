import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-pine">Connecticut</p>
            <Link href="/" className="font-serif text-xl tracking-tight">
              Website Opportunities
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink/75">
            <Link href="/leads" className="transition hover:text-pine">
              Leads
            </Link>
            <Link href="/leads/new" className="transition hover:text-pine">
              Add website
            </Link>
            <Link href="/leads/import" className="transition hover:text-pine">
              Import CSV
            </Link>
            <Link href="/jobs" className="transition hover:text-pine">
              Jobs
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
