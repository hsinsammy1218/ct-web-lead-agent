import { lookup } from "node:dns/promises";
import { addressesArePublic, assertPublicHttpUrl, type FetchObservation } from "@ct/core";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_500_000;

export async function fetchPublicSite(rawUrl: string): Promise<FetchObservation> {
  let current = assertPublicHttpUrl(rawUrl).href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = assertPublicHttpUrl(current);
    const resolved = await lookup(url.hostname, { all: true });
    addressesArePublic(resolved.map((entry) => entry.address));
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "CTWebLeadAgent/0.1 (internal website audit)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { finalUrl: url.href, statusCode: response.status, html: null, error: "Redirect missing location", blocked: false };
      current = new URL(location, url).href;
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      return { finalUrl: url.href, statusCode: response.status, html: null, error: `HTTP ${response.status}`, blocked: true };
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { finalUrl: url.href, statusCode: response.status, html: null, error: "Response is too large", blocked: false };
    }
    const html = new TextDecoder().decode(buffer);
    if (/captcha|cf-challenge|attention required/i.test(html) && response.status >= 400) {
      return { finalUrl: url.href, statusCode: response.status, html: null, error: "Automated access was challenged", blocked: true };
    }
    return { finalUrl: url.href, statusCode: response.status, html, error: response.ok ? null : `HTTP ${response.status}`, blocked: false };
  }
  return { finalUrl: current, statusCode: null, html: null, error: "Too many redirects", blocked: false };
}
