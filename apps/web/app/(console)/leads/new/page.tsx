import { PasteIntakeForm } from "../../../../components/paste-intake-form";
import { getReferenceData, storeError } from "../../../../lib/store";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  let reference;
  let loadError: string | null = null;
  try {
    reference = await getReferenceData();
  } catch (caught) {
    loadError = storeError(caught, "Could not load form options").message;
  }
  if (loadError || !reference) {
    return (
      <section className="rounded-lg border border-red-300 bg-white p-6">
        <h1 className="font-serif text-2xl">Add website is unavailable</h1>
        <p className="mt-2 text-sm">{loadError}</p>
      </section>
    );
  }
  const industries = reference.industries
    .filter((industry) => industry.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((industry) => ({ value: industry.slug, label: industry.displayName }));
  const municipalities = reference.municipalities.map((municipality) => ({
    value: municipality.name,
    label: municipality.name,
  }));

  return (
    <section className="max-w-2xl">
      <h1 className="font-serif text-3xl">Add a website</h1>
      <p className="mt-2 text-sm text-ink/70">
        Paste a URL or business information and let the agent fill the intake fields. Review them, then queue the audit.
        If that website or business is already on file (especially if audited), we open the existing lead instead of
        creating another.
      </p>
      <div className="mt-6">
        <PasteIntakeForm
          municipalities={municipalities}
          industries={industries}
          error={params.error}
          duplicate={params.duplicate}
          initialDraft={{
            businessName: params.business_name ?? "",
            municipality: params.municipality ?? "",
            industry: params.industry ?? "",
            websiteUrl: params.website_url ?? "",
            phone: params.phone ?? "",
          }}
        />
      </div>
    </section>
  );
}
