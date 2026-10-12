import { findIndustry, findMunicipality, normalizeLookup, regionFor } from "./reference.js";
import type { NormalizedSubmission, ReferenceData, SubmissionInput } from "./types.js";
import { classifyHost, registrableDomain } from "./url.js";
import { assertPublicHttpUrl } from "./ssrf.js";

export interface IntakeSuccess {
  ok: true;
  value: NormalizedSubmission;
}

export interface IntakeFailure {
  ok: false;
  message: string;
}

export function validateSubmission(
  input: SubmissionInput,
  data: ReferenceData,
): IntakeSuccess | IntakeFailure {
  const businessName = input.businessName.trim();
  if (businessName.length < 2) {
    return { ok: false, message: "Business name is required" };
  }
  const municipality = findMunicipality(input.municipality, data.municipalities);
  if (!municipality) {
    return { ok: false, message: "Municipality must be one of the 169 Connecticut municipalities" };
  }
  const region = regionFor(municipality, data.regions);
  if (!region) {
    return { ok: false, message: "Municipality is missing a planning region" };
  }
  const industry = findIndustry(input.industry, data.industries);
  if (!industry) {
    return { ok: false, message: "Industry is not in the configured list" };
  }
  let website: URL;
  try {
    website = assertPublicHttpUrl(input.websiteUrl.trim());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "URL is not valid" };
  }
  const domain = registrableDomain(website.href);
  if (!domain) {
    return { ok: false, message: "Website URL needs a public domain" };
  }
  const phone = normalizePhone(input.phone);
  if (input.phone?.trim() && !phone) {
    return { ok: false, message: "Phone must be a 10-digit US number or left blank" };
  }
  return {
    ok: true,
    value: {
      businessName,
      nameNormalized: normalizeLookup(businessName),
      municipality,
      region,
      industry,
      websiteUrl: website.href,
      registrableDomain: domain,
      phone,
      note: input.note?.trim() ? input.note.trim() : null,
      hostClass: classifyHost(website.href),
    },
  };
}

export function normalizePhone(input: string | undefined): string | null {
  if (!input || !input.trim()) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function submissionFromCsvRow(values: Record<string, string>): SubmissionInput {
  return {
    businessName: values.business_name ?? values.name ?? "",
    municipality: values.municipality ?? values.town ?? "",
    industry: values.industry ?? "",
    websiteUrl: values.website_url ?? values.website ?? values.url ?? "",
    phone: values.phone ?? "",
    note: values.note ?? "",
  };
}

export function decideDuplicate(existing: boolean, allowDuplicate: boolean): "create" | "skip" {
  if (existing && !allowDuplicate) return "skip";
  return "create";
}
