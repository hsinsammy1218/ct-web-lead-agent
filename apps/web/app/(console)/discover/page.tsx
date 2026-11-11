import { DiscoverScanForm } from "../../../components/discover-scan-form";
import { getReferenceData, storeError } from "../../../lib/store";

export default async function DiscoverPage() {
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
        <h1 className="font-serif text-2xl">Discovery is unavailable</h1>
        <p className="mt-2 text-sm">{loadError}</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="font-serif text-3xl">Find CT businesses</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Scans Google Places for Connecticut businesses with no website, only a social/directory page, or an outdated site. Requires{" "}
        <code className="rounded bg-white px-1">GOOGLE_PLACES_API_KEY</code> (Places API New). Same scan is available as{" "}
        <code className="rounded bg-white px-1">POST /api/discovery/scan</code>.
      </p>
      <DiscoverScanForm
        municipalities={reference.municipalities.map((item) => ({ value: item.name, label: item.name }))}
        industries={reference.industries.filter((item) => item.enabled).map((item) => ({ value: item.slug, label: item.displayName }))}
      />
    </section>
  );
}
