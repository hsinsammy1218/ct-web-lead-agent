import Link from "next/link";
import { HOST_CLASSES, LEAD_STATUSES, SCORE_BANDS } from "@ct/core";
import { bandLabel, hostLabel, serviceLabel, statusLabel } from "../../../lib/labels";
import { exportQuery, filtersFromParams, scoreText } from "../../../lib/filters";
import { getStore } from "../../../lib/store";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = getStore();
  const reference = store.referenceData();
  const filters = filtersFromParams(params);
  let leads;
  let error: string | null = null;
  try {
    leads = await store.listLeads(filters);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Leads could not be loaded";
  }
  if (error || !leads) {
    return (
      <section className="rounded-lg border border-red-300 bg-white p-6">
        <h1 className="font-serif text-2xl">Leads are unavailable</h1>
        <p className="mt-2 text-sm">{error}</p>
      </section>
    );
  }
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Submitted websites</h1>
          <p className="mt-1 text-sm text-ink/70">{leads.length} matching leads</p>
        </div>
        <a href={`/export${exportQuery(filters)}`} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          Export CSV
        </a>
      </div>
      <form className="mt-4 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <Select name="municipality" label="Municipality" value={filters.municipality ?? ""} options={reference.municipalities.map((item) => [item.name, item.name])} />
        <Select name="region" label="Planning region" value={filters.region ?? ""} options={reference.regions.map((item) => [item.id, item.name])} />
        <Select name="industry" label="Industry" value={filters.industry ?? ""} options={reference.industries.filter((item) => item.enabled).map((item) => [item.slug, item.displayName])} />
        <Select name="band" label="Score band" value={filters.band ?? ""} options={SCORE_BANDS.map((item) => [item, bandLabel(item)])} />
        <Select name="website_status" label="Website status" value={filters.websiteStatus ?? ""} options={HOST_CLASSES.map((item) => [item, hostLabel(item)])} />
        <Select name="audit_status" label="Audit status" value={filters.auditStatus ?? ""} options={["queued", "completed", "failed", "blocked", "skipped"].map((item) => [item, statusLabel(item)])} />
        <Select name="contact" label="Contact availability" value={filters.contact ?? ""} options={[["yes", "Has a contact"], ["no", "No contact"]]} />
        <Select name="lead_status" label="Lead status" value={filters.leadStatus ?? ""} options={LEAD_STATUSES.map((item) => [item, statusLabel(item)])} />
        <label className="text-sm">
          Submitted from
          <input name="submitted_from" inputMode="numeric" placeholder="YYYY-MM-DD" defaultValue={filters.submittedFrom ?? ""} className="mt-1 w-full rounded-md border border-line px-2 py-2" />
        </label>
        <label className="text-sm">
          Submitted to
          <input name="submitted_to" inputMode="numeric" placeholder="YYYY-MM-DD" defaultValue={filters.submittedTo ?? ""} className="mt-1 w-full rounded-md border border-line px-2 py-2" />
        </label>
        <Select
          name="sort"
          label="Sort"
          value={filters.sort ?? "submitted_desc"}
          options={[
            ["opportunity_desc", "Opportunity, highest"],
            ["quality_asc", "Quality, lowest"],
            ["submitted_desc", "Recently submitted"],
            ["audited_desc", "Recently audited"],
            ["industry", "Industry"],
            ["municipality", "Municipality"],
          ]}
          includeBlank={false}
        />
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-pine px-3 py-2 text-sm text-white">
            Apply
          </button>
          <Link href="/leads" className="rounded-md border border-line px-3 py-2 text-sm">
            Clear
          </Link>
        </div>
      </form>
      {leads.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-white p-6">
          <h2 className="font-serif text-xl">No leads match these filters</h2>
          <p className="mt-2 text-sm text-ink/70">Add a website you already found, or widen the filters.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink/50">
              <tr>
                {["Name", "Municipality", "Industry", "Website", "Host", "Quality", "Opportunity", "Contact", "Service", "Last audited", "Status"].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-line/80 align-top">
                  <td className="px-3 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-pine">
                      {lead.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{lead.municipalityName}</td>
                  <td className="px-3 py-3">{lead.industryName}</td>
                  <td className="px-3 py-3">{lead.website.registrableDomain}</td>
                  <td className="px-3 py-3">{hostLabel(lead.website.status)}</td>
                  <td className="px-3 py-3">{lead.audit?.status === "blocked" ? "Blocked" : scoreText(lead.score?.quality)}</td>
                  <td className="px-3 py-3">{scoreText(lead.score?.opportunity)}</td>
                  <td className="px-3 py-3">{scoreText(lead.score?.contact)}</td>
                  <td className="px-3 py-3">{serviceLabel(lead.score?.recommendedService)}</td>
                  <td className="px-3 py-3">{lead.audit?.auditedAt ? lead.audit.auditedAt.slice(0, 10) : "Pending"}</td>
                  <td className="px-3 py-3">{statusLabel(lead.leadStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Select({
  name,
  label,
  value,
  options,
  includeBlank = true,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  includeBlank?: boolean;
}) {
  return (
    <label className="text-sm">
      {label}
      <select name={name} defaultValue={value} className="mt-1 w-full rounded-md border border-line bg-white px-2 py-2">
        {includeBlank ? <option value="">Any</option> : null}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
