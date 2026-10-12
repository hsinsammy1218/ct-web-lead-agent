import { submitWebsite } from "../../../actions";
import { SubmitButton } from "../../../../components/submit-button";
import { getStore } from "../../../../lib/store";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const reference = getStore().referenceData();
  const industries = reference.industries.filter((industry) => industry.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section className="max-w-xl">
      <h1 className="font-serif text-3xl">Add a website</h1>
      <p className="mt-2 text-sm text-ink/70">
        Enter a site you already found. The worker fetches that URL only. It does not search for another one.
      </p>
      {params.error ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm">{params.error}</p>
      ) : null}
      <form action={submitWebsite} className="mt-6 space-y-4 rounded-lg border border-line bg-white p-5">
        <Field label="Business name" name="business_name" required />
        <label className="block text-sm font-medium">
          Municipality
          <select name="municipality" required className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal">
            <option value="">Choose a Connecticut town</option>
            {reference.municipalities.map((municipality) => (
              <option key={municipality.opmCode} value={municipality.name}>
                {municipality.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Industry
          <select name="industry" required className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal">
            <option value="">Choose an industry</option>
            {industries.map((industry) => (
              <option key={industry.slug} value={industry.slug}>
                {industry.displayName}
              </option>
            ))}
          </select>
        </label>
        <Field label="Website URL" name="website_url" type="url" required placeholder="https://" />
        <Field label="Phone (optional)" name="phone" />
        <label className="block text-sm font-medium">
          Note (optional)
          <textarea name="note" rows={3} className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal" />
        </label>
        {params.duplicate ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="allow_duplicate" className="mt-1" />
            This is a different business on a domain that is already on file.
          </label>
        ) : null}
        <SubmitButton label="Queue audit" pendingLabel="Saving…" />
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full rounded-md border border-line px-3 py-2 font-normal" />
    </label>
  );
}
