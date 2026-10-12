import type { LeadFilters } from "@ct/db";

export function filtersFromParams(params: Record<string, string | undefined>): LeadFilters {
  return {
    municipality: params.municipality || undefined,
    region: params.region || undefined,
    industry: params.industry || undefined,
    band: params.band || undefined,
    websiteStatus: params.website_status || undefined,
    auditStatus: params.audit_status || undefined,
    contact: params.contact || undefined,
    submittedFrom: params.submitted_from || undefined,
    submittedTo: params.submitted_to || undefined,
    leadStatus: params.lead_status || undefined,
    sort: params.sort || "submitted_desc",
  };
}

export function exportQuery(filters: LeadFilters): string {
  const search = new URLSearchParams();
  const entries: Array<[string, string | undefined]> = [
    ["municipality", filters.municipality],
    ["region", filters.region],
    ["industry", filters.industry],
    ["band", filters.band],
    ["website_status", filters.websiteStatus],
    ["audit_status", filters.auditStatus],
    ["contact", filters.contact],
    ["submitted_from", filters.submittedFrom],
    ["submitted_to", filters.submittedTo],
    ["lead_status", filters.leadStatus],
    ["sort", filters.sort],
  ];
  for (const [key, value] of entries) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function scoreText(value: number | null | undefined): string {
  return value == null ? "—" : String(value);
}
