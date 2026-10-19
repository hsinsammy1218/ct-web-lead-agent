import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-pine">Connecticut</p>
            <Link href="/" className="font-serif text-xl">
              Website Opportunities
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href="/leads">Leads</Link>
            <Link href="/leads/new">Add website</Link>
            <Link href="/leads/import">Import CSV</Link>
            <Link href="/jobs">Jobs</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
