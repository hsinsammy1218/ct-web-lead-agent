import type { Assessment } from "./ai.js";
import type { Finding, LeadScore, RecommendedService } from "./types.js";
import { buildInYourCornerBoxingSite, isInYourCornerBoxing } from "./site-from-source.js";
import { buildProfessionalSite } from "./site-professional.js";

export interface DraftSiteInput {
  leadId: string;
  businessName: string;
  municipality: string;
  planningRegion: string;
  industry: string;
  phone: string | null;
  currentUrl: string;
  hostClass: string;
  findings: Finding[];
  score: LeadScore | null;
  ai: Assessment | null;
}

export interface DraftSiteFile {
  path: string;
  content: string;
}

export interface DraftSiteResult {
  html: string;
  brief: DraftSiteBrief;
  /** Extra site files (CSS, secondary pages). Always includes enough to publish a complete site. */
  files?: DraftSiteFile[];
}

export interface DraftSiteBrief {
  leadId: string;
  businessName: string;
  generatedAt: string;
  recommendedService: RecommendedService | null;
  opportunity: number | null;
  band: string | null;
  currentUrl: string;
  fixesApplied: string[];
  findingsAddressed: string[];
  summary: string;
}

const FIX_COPY: Record<string, string> = {
  missing_title: "Added a clear page title with the business name and town.",
  title_length: "Set a concise title under 60 characters.",
  missing_meta_description: "Wrote a unique meta description for local search.",
  heading_structure: "Used one H1 for the business name and supporting H2 sections.",
  missing_canonical: "Included a self-referencing canonical URL.",
  missing_local_business_schema: "Added LocalBusiness JSON-LD with name and locality.",
  no_click_to_call: "Added a click-to-call button in the hero and footer.",
  no_email: "Added a contact form so visitors can reach the business.",
  no_contact_form: "Added a working contact / quote request form.",
  no_nav: "Added primary navigation.",
  no_street_address: "Highlighted the Connecticut municipality for local relevance.",
  images_missing_alt: "Included photography with descriptive alt text.",
  missing_viewport: "Set a mobile viewport meta tag.",
  missing_lang: "Set html lang to en.",
  not_an_official_site: "Replaced the social/directory presence with an official company homepage.",
  access_blocked: "Built a new homepage because the live site could not be audited.",
  fetch_failed: "Built a new homepage because the live site could not be fetched.",
  business_name_not_on_page: "Put the submitted business name in the H1 and title.",
};

export function fixesFromFindings(findings: Finding[], hostClass: string): string[] {
  const codes = new Set(findings.map((finding) => finding.code));
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY" || hostClass === "PLATFORM_SITE") {
    codes.add("not_an_official_site");
  }
  if (hostClass === "BLOCKED") codes.add("access_blocked");
  if (hostClass === "UNREACHABLE") codes.add("fetch_failed");
  for (const code of [
    "missing_meta_description",
    "heading_structure",
    "no_click_to_call",
    "no_contact_form",
    "missing_local_business_schema",
    "missing_viewport",
    "images_missing_alt",
  ]) {
    codes.add(code);
  }
  return [...codes]
    .map((code) => FIX_COPY[code])
    .filter((text): text is string => Boolean(text));
}

/**
 * Post-audit website deliverable.
 * - Known curated businesses (e.g. IYC) get a source-faithful specialty rebuild.
 * - Everyone else gets a multi-page professional site:
 *   - update/redesign when an operator site can be read
 *   - new site when the lead is social/directory/blocked/unreachable
 */
export function buildDraftSite(input: DraftSiteInput & { sourceHtml?: string | null }): DraftSiteResult {
  if (isInYourCornerBoxing(input, input.sourceHtml)) {
    return buildInYourCornerBoxingSite(input);
  }
  return buildProfessionalSite(input);
}
