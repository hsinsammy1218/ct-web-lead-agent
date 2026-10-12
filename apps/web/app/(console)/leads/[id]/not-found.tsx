import Link from "next/link";

export default function LeadNotFound() {
  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <h1 className="font-serif text-2xl">Lead not found</h1>
      <p className="mt-2 text-sm">That submission is not in the store.</p>
      <Link href="/leads" className="mt-4 inline-block text-sm text-pine">
        Back to leads
      </Link>
    </section>
  );
}
