import { findIndustry, findMunicipality } from "./reference.js";
import type { HostClass, ReferenceData } from "./types.js";
import { classifyHost } from "./url.js";

export type DiscoveryOpportunity = "no_website" | "weak_website" | "outdated_website" | "skip";

export interface DiscoveryPlace {
  placeId: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  businessStatus: string | null;
}

export interface DiscoveryCandidate extends DiscoveryPlace {
  opportunity: DiscoveryOpportunity;
  hostClass: HostClass | null;
  reason: string;
  enqueueable: boolean;
}

export interface DiscoveryScanInput {
  municipality: string;
  industry: string;
  maxResults?: number;
  /** When true, fetch each operator website and apply cheap outdated heuristics. */
  probeOutdated?: boolean;
  apiKey: string;
  reference: ReferenceData;
  fetchImpl?: typeof fetch;
}

export interface DiscoveryScanResult {
  query: string;
  municipality: string;
  industrySlug: string;
  industryName: string;
  candidates: DiscoveryCandidate[];
  summary: {
    total: number;
    noWebsite: number;
    weakWebsite: number;
    outdatedWebsite: number;
    skipped: number;
  };
}

interface PlacesSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;
    businessStatus?: string;
  }>;
  error?: { message?: string; status?: string };
}

const WEAK_HOSTS: HostClass[] = ["SOCIAL_ONLY", "DIRECTORY_ONLY", "PLATFORM_SITE"];

/** Rough Places Text Text cost used for budget checks (USD). */
export const DISCOVERY_SCAN_COST_USD = Number(process.env.DISCOVERY_COST_USD_PER_REQUEST ?? 0.04);

export function buildDiscoveryQuery(industryDisplayName: string, municipalityName: string): string {
  return `${industryDisplayName} in ${municipalityName}, Connecticut`;
}

export function classifyDiscoveryPlace(place: DiscoveryPlace, outdated = false): DiscoveryCandidate {
  if (!place.websiteUrl) {
    return {
      ...place,
      opportunity: "no_website",
      hostClass: null,
      reason: "Google Places has no website for this business",
      enqueueable: false,
    };
  }
  const hostClass = classifyHost(place.websiteUrl);
  if (WEAK_HOSTS.includes(hostClass)) {
    return {
      ...place,
      opportunity: "weak_website",
      hostClass,
      reason: `Listed website is ${hostClass.replaceAll("_", " ").toLowerCase()} — usually means no real business site`,
      enqueueable: true,
    };
  }
  if (outdated) {
    return {
      ...place,
      opportunity: "outdated_website",
      hostClass,
      reason: "Website looks stale or poorly maintained",
      enqueueable: true,
    };
  }
  return {
    ...place,
    opportunity: "skip",
    hostClass,
    reason: "Has an operator website; run a full audit later if you want quality scores",
    enqueueable: true,
  };
}

export async function probeWebsiteOutdated(
  websiteUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ outdated: boolean; detail: string }> {
  try {
    const response = await fetchImpl(websiteUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "CT-Web-Lead-Agent-Discovery/1.0" },
    });
    if (!response.ok) {
      return { outdated: true, detail: `HTTP ${response.status}` };
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html/i.test(contentType)) {
      return { outdated: false, detail: contentType || "non-html" };
    }
    const html = (await response.text()).slice(0, 120_000).toLowerCase();
    const signals: string[] = [];
    const yearMatch = html.match(/©\s*(20\d{2})|copyright\s+(20\d{2})/i);
    if (yearMatch) {
      const year = Number(yearMatch[1] ?? yearMatch[2]);
      if (Number.isFinite(year) && year <= new Date().getFullYear() - 4) {
        signals.push(`copyright ${year}`);
      }
    }
    if (/frameset|marquee|guestbook|under construction|coming soon|website coming soon/i.test(html)) {
      signals.push("legacy or placeholder markup");
    }
    if (/generator"\s+content="wordpress\s+[1-3]\./i.test(html)) {
      signals.push("very old WordPress generator");
    }
    if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
      signals.push("no mobile viewport");
    }
    if (!/<title>[^<]{2,}<\/title>/i.test(html)) {
      signals.push("missing title");
    }
    if (signals.length >= 2) {
      return { outdated: true, detail: signals.join("; ") };
    }
    return { outdated: false, detail: signals[0] ?? "looks maintained enough" };
  } catch (error) {
    return {
      outdated: true,
      detail: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

export async function searchPlacesText(input: {
  query: string;
  apiKey: string;
  maxResults: number;
  fetchImpl?: typeof fetch;
}): Promise<DiscoveryPlace[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": input.apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery: input.query,
      regionCode: "US",
      maxResultCount: Math.min(Math.max(input.maxResults, 1), 20),
      locationBias: {
        rectangle: {
          // Rough Connecticut bounding box so results stay local.
          low: { latitude: 40.95, longitude: -73.75 },
          high: { latitude: 42.05, longitude: -71.78 },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as PlacesSearchResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Places search failed (${response.status})`);
  }
  return (payload.places ?? [])
    .map((place) => {
      const businessName = place.displayName?.text?.trim() ?? "";
      if (!businessName) return null;
      return {
        placeId: place.id ?? businessName,
        businessName,
        address: place.formattedAddress ?? null,
        phone: place.nationalPhoneNumber ?? null,
        websiteUrl: place.websiteUri ?? null,
        mapsUrl: place.googleMapsUri ?? null,
        businessStatus: place.businessStatus ?? null,
      } satisfies DiscoveryPlace;
    })
    .filter((place): place is DiscoveryPlace => Boolean(place))
    .filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY");
}

export async function runDiscoveryScan(input: DiscoveryScanInput): Promise<DiscoveryScanResult> {
  const municipality = findMunicipality(input.municipality, input.reference.municipalities);
  if (!municipality) {
    throw new Error("Municipality must be one of the 169 Connecticut municipalities");
  }
  const industry = findIndustry(input.industry, input.reference.industries);
  if (!industry || !industry.enabled) {
    throw new Error("Industry is not in the enabled list");
  }
  const maxResults = Math.min(Math.max(input.maxResults ?? 20, 1), 20);
  const query = buildDiscoveryQuery(industry.displayName, municipality.name);
  const places = await searchPlacesText({
    query,
    apiKey: input.apiKey,
    maxResults,
    fetchImpl: input.fetchImpl,
  });

  const candidates: DiscoveryCandidate[] = [];
  for (const place of places) {
    // Keep CT-looking addresses; Places can still leak neighbors.
    if (place.address && !/\bCT\b|Connecticut/i.test(place.address)) {
      candidates.push({
        ...place,
        opportunity: "skip",
        hostClass: place.websiteUrl ? classifyHost(place.websiteUrl) : null,
        reason: "Address is outside Connecticut",
        enqueueable: false,
      });
      continue;
    }
    let outdated = false;
    let outdatedDetail = "";
    if (input.probeOutdated && place.websiteUrl && classifyHost(place.websiteUrl) === "OPERATOR_SITE") {
      const probe = await probeWebsiteOutdated(place.websiteUrl, input.fetchImpl);
      outdated = probe.outdated;
      outdatedDetail = probe.detail;
    }
    const candidate = classifyDiscoveryPlace(place, outdated);
    if (outdated && outdatedDetail) {
      candidate.reason = `Website looks outdated (${outdatedDetail})`;
    }
    candidates.push(candidate);
  }

  const summary = {
    total: candidates.length,
    noWebsite: candidates.filter((item) => item.opportunity === "no_website").length,
    weakWebsite: candidates.filter((item) => item.opportunity === "weak_website").length,
    outdatedWebsite: candidates.filter((item) => item.opportunity === "outdated_website").length,
    skipped: candidates.filter((item) => item.opportunity === "skip").length,
  };

  return {
    query,
    municipality: municipality.name,
    industrySlug: industry.slug,
    industryName: industry.displayName,
    candidates,
    summary,
  };
}

/** Opportunities worth surfacing as leads for the operator. */
export function isDiscoveryOpportunity(opportunity: DiscoveryOpportunity): boolean {
  return opportunity === "no_website" || opportunity === "weak_website" || opportunity === "outdated_website";
}
