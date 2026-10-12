import Link from "next/link";
import { getStore } from "../../lib/store";

export default async function HomePage() {
  let stats;
  let error: string | null = null;
  try {
    stats = await getStore().stats();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The lead store is unavailable";
  }
  if (error || !stats) {
    return (
      <section className="rounded-lg border border-red-300 bg-white p-6">
        <h1 className="font-serif text-2xl">The dashboard could not load</h1>
        <p className="mt-2 text-sm">{error}</p>
      </section>
    );
  }
  const cards = [
    ["Submitted businesses", stats.submitted],
    ["Audits in progress", stats.auditsInProgress],
    ["Audits completed", stats.auditsCompleted],
    ["Qualified leads", stats.qualified],
    ["High-priority leads", stats.highPriority],
    ["Blocked audits", stats.blocked],
    ["API spend today", `$${stats.spentDayUsd.toFixed(2)}`],
    ["API spend this month", `$${stats.spentMonthUsd.toFixed(2)}`],
  ];
  return (
    <section>
      <h1 className="font-serif text-3xl">Connecticut Website Opportunities</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Add a website you have already found. The worker fetches that URL, records measured problems, and scores the opportunity. It does not look for other sites.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-lg border border-line bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
            <p className="mt-2 font-serif text-2xl">{value}</p>
          </article>
        ))}
      </div>
      {stats.submitted === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line bg-white p-6">
          <h2 className="font-serif text-xl">No websites yet</h2>
          <p className="mt-2 text-sm text-ink/70">Submit the first business when you have its URL, town, and trade.</p>
          <Link href="/leads/new" className="mt-4 inline-block rounded-md bg-pine px-4 py-2 text-sm text-white">
            Add website
          </Link>
        </div>
      ) : (
        <Link href="/leads" className="mt-8 inline-block text-sm text-pine">
          Review the lead table
        </Link>
      )}
    </section>
  );
}
