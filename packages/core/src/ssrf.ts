const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs can be fetched");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new UnsafeUrlError("That host is blocked");
  }
  if (isIpLiteral(host) && isPrivateAddress(host)) {
    throw new UnsafeUrlError("Private network addresses are blocked");
  }
  return url;
}

export function isIpLiteral(host: string): boolean {
  return isIpv4(host) || host.includes(":");
}

export function isPrivateAddress(ip: string): boolean {
  const host = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "::1" || host === "0.0.0.0" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  if (!isIpv4(host)) return false;
  const [a, b] = host.split(".").map((part) => Number(part)) as [number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export function addressesArePublic(addresses: string[]): void {
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnsafeUrlError("DNS resolved to a private address");
    }
  }
}
