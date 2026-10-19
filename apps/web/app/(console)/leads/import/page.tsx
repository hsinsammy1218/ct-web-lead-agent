import { importCsv } from "../../../actions";
import { SubmitButton } from "../../../../components/submit-button";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <section className="max-w-2xl">
      <h1 className="font-serif text-3xl">Import CSV</h1>
      <p className="mt-2 text-sm text-ink/70">
        Columns: business_name, municipality, industry, website_url, phone, note. Invalid rows are skipped. Websites or businesses already on file (especially if audited) are skipped unless you allow a different business on the same domain.
      </p>
      {params.accepted || params.rejected ? (
        <div className="mt-4 rounded-md border border-line bg-white px-3 py-2 text-sm">
          <p>
            Accepted {params.accepted ?? "0"}. Rejected {params.rejected ?? "0"}.
          </p>
          {params.summary ? <p className="mt-2 text-ink/70">{params.summary}</p> : null}
        </div>
      ) : null}
      <form action={importCsv} className="mt-6 space-y-4 rounded-lg border border-line bg-white p-5">
        <label className="block text-sm font-medium">
          CSV file
          <input name="file" type="file" accept=".csv,text/csv" className="mt-1 block w-full text-sm font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Or paste rows
          <textarea name="csv" rows={8} className="mt-1 w-full rounded-md border border-line px-3 py-2 font-mono text-xs font-normal" placeholder="business_name,municipality,industry,website_url,phone,note" />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="allow_duplicate" className="mt-1" />
          Import a domain even if a lead already uses it.
        </label>
        <SubmitButton label="Import" pendingLabel="Importing…" />
      </form>
    </section>
  );
}
