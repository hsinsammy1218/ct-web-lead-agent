import { getDomain } from "tldts";
import type { HostClass } from "./types.js";

const SOCIAL_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "nextdoor.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
]);

const DIRECTORY_DOMAINS = new Set([
  "yelp.com",
  "yellowpages.com",
  "angi.com",
  "angieslist.com",
  "bbb.org",
  "mapquest.com",
  "superpages.com",
  "thumbtack.com",
  "homeadvisor.com",
  "manta.com",
  "birdeye.com",
]);

const PLATFORM_DOMAINS = new Set([
  "square.site",
  "squareup.com",
  "toasttab.com",
  "vagaro.com",
  "fresha.com",
  "glossgenius.com",
  "schedulicity.com",
  "setmore.com",
  "calendly.com",
  "booksy.com",
  "styleseat.com",
  "opentable.com",
]);

export function registrableDomain(rawUrl: string): string | null {
  const domain = getDomain(rawUrl, { validHosts: ["localhost"] });
  if (!domain) return null;
  return domain.toLowerCase();
}

export function classifyHost(rawUrl: string): HostClass {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "UNREACHABLE";
  }
  const domain = registrableDomain(url.href);
  if (!domain) return "UNREACHABLE";
  if (SOCIAL_DOMAINS.has(domain)) return "SOCIAL_ONLY";
  if (DIRECTORY_DOMAINS.has(domain)) return "DIRECTORY_ONLY";
  if (PLATFORM_DOMAINS.has(domain)) return "PLATFORM_SITE";
  if (domain === "google.com" && url.pathname.startsWith("/maps")) return "DIRECTORY_ONLY";
  if (domain === "apple.com" && url.pathname.includes("/maps")) return "DIRECTORY_ONLY";
  return "OPERATOR_SITE";
}

export function isAuditCandidate(hostClass: HostClass): boolean {
  return hostClass === "OPERATOR_SITE" || hostClass === "PLATFORM_SITE";
}
