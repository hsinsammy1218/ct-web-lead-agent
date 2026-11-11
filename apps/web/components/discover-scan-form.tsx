"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

interface ReferenceOption {
  value: string;
  label: string;
}

interface ScanCandidate {
  placeId: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  opportunity: string;
  reason: string;
}

interface ScanResponse {
  error?: string;
  query?: string;
  municipality?: string;
  industry?: string;
  summary?: {
    noWebsite: number;
    weakWebsite: number;
    outdatedWebsite: number;
    skipped: number;
  };
  candidates?: ScanCandidate[];
  enqueued?: Array<{ businessName: string; leadId: string | null; message: string }>;
}

export function DiscoverScanForm({
  municipalities,
  industries,
}: {
  municipalities: ReferenceOption[];
  industries: ReferenceOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/discovery/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            municipality: String(formData.get("municipality") ?? ""),
            industry: String(formData.get("industry") ?? ""),
            maxResults: Number(formData.get("max_results") ?? 15),
            probeOutdated: formData.get("probe_outdated") === "on",
            enqueue: formData.get("enqueue") === "on",
          }),
        });
        const payload = (await response.json()) as ScanResponse;
        if (!response.ok) {
          setResult(null);
          setError(payload.error ?? `Scan failed (${response.status})`);
          return;
        }
        setResult(payload);
      } catch (caught) {
        setResult(null);
        setError(caught instanceof Error ? caught.message : "Scan failed");
      }
    });
  }

  return (
    <div>
      <form action={onSubmit} className="mt-6 grid max-w-2xl gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
        <label className="text-sm">
          Municipality
          <select name="municipality" required className="mt-1 w-full rounded-md border border-line bg-white px-2 py-2">
            <option value="">Select town</option>
            {municipalities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Industry
          <select name="industry" required className="mt-1 w-full rounded-md border border-line bg-white px-2 py-2">
            <option value="">Select industry</option>
            {industries.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Max results
          <input name="max_results" type="number" min={1} max={20} defaultValue={15} className="mt-1 w-full rounded-md border border-line px-2 py-2" />
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="probe_outdated" defaultChecked />
            Probe operator sites for outdated signals
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enqueue" />
            Queue weak/outdated websites for audit
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-pine px-4 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Scanning…" : "Run scan"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-300 bg-white p-4 text-sm">
          <p className="font-medium">Scan failed</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {result?.summary && result.query ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="font-serif text-xl">Results for {result.query}</h2>
            <p className="mt-2 text-sm text-ink/70">
              {result.summary.noWebsite} no website · {result.summary.weakWebsite} weak · {result.summary.outdatedWebsite} outdated ·{" "}
              {result.summary.skipped} skipped
            </p>
          </div>
          {(result.candidates ?? []).length === 0 ? (
            <p className="text-sm text-ink/70">No missing/weak/outdated opportunities in this scan.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    {["Business", "Opportunity", "Website", "Phone", "Why", "Action"].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.candidates ?? []).map((candidate) => (
                    <tr key={`${candidate.placeId}-${candidate.businessName}`} className="border-b border-line/80 align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium">{candidate.businessName}</p>
                        <p className="text-xs text-ink/55">{candidate.address}</p>
                      </td>
                      <td className="px-3 py-3">{labelOpportunity(candidate.opportunity)}</td>
                      <td className="px-3 py-3">
                        {candidate.websiteUrl ? (
                          <a href={candidate.websiteUrl} className="text-pine" target="_blank" rel="noreferrer">
                            {candidate.websiteUrl.replace(/^https?:\/\//, "").slice(0, 40)}
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                      <td className="px-3 py-3">{candidate.phone ?? "—"}</td>
                      <td className="px-3 py-3 text-ink/70">{candidate.reason}</td>
                      <td className="px-3 py-3">
                        {candidate.websiteUrl && result.municipality && result.industry ? (
                          <Link
                            href={`/leads/new?business_name=${encodeURIComponent(candidate.businessName)}&municipality=${encodeURIComponent(result.municipality)}&industry=${encodeURIComponent(result.industry)}&website_url=${encodeURIComponent(candidate.websiteUrl)}&phone=${encodeURIComponent(candidate.phone ?? "")}`}
                            className="text-pine"
                          >
                            Add lead
                          </Link>
                        ) : candidate.mapsUrl ? (
                          <a href={candidate.mapsUrl} className="text-pine" target="_blank" rel="noreferrer">
                            Open Maps
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.enqueued?.length ? (
            <div className="rounded-lg border border-line bg-white p-4 text-sm">
              <h3 className="font-serif text-lg">Queued for audit</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.enqueued.map((row) => (
                  <li key={`${row.businessName}-${row.leadId ?? row.message}`}>
                    {row.leadId ? (
                      <Link href={`/leads/${row.leadId}`} className="text-pine">
                        {row.businessName}
                      </Link>
                    ) : (
                      row.businessName
                    )}
                    {" — "}
                    {row.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function labelOpportunity(value: string): string {
  if (value === "no_website") return "No website";
  if (value === "weak_website") return "Weak website";
  if (value === "outdated_website") return "Outdated";
  return value;
}
