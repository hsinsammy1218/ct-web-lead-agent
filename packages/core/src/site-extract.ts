import { parse } from "node-html-parser";

export interface ExtractedImage {
  src: string;
  alt: string;
}

export interface ExtractedSite {
  title: string | null;
  description: string | null;
  headings: string[];
  paragraphs: string[];
  images: ExtractedImage[];
  emails: string[];
  phones: string[];
  socialLinks: Array<{ label: string; href: string }>;
  navLabels: string[];
}

const SKIP_IMAGE =
  /pixel|tracking|sprite|1x1|favicon|logo-mark|badge|icon-|spacer|blank\.|placeholder|gravatar|facebook\.com\/tr|google-analytics|doubleclick/i;
const SOCIAL_HOST = /instagram\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|tiktok\.com|linkedin\.com|x\.com|twitter\.com/i;

/** Pull usable brand/content signals from a live business page for a source-faithful rebuild. */
export function extractSiteContent(html: string, baseUrl: string): ExtractedSite {
  const root = parse(html);
  for (const node of root.querySelectorAll("script, style, noscript, svg, iframe")) {
    node.remove();
  }

  const title = cleanText(root.querySelector("title")?.text ?? null);
  const description =
    cleanText(root.querySelector('meta[name="description"]')?.getAttribute("content") ?? null) ??
    cleanText(root.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null);

  const headings = unique(
    root
      .querySelectorAll("h1, h2, h3")
      .map((node) => cleanText(node.text))
      .filter((text): text is string => Boolean(text) && text.length >= 3 && text.length <= 120),
  ).slice(0, 16);

  const paragraphs = unique(
    root
      .querySelectorAll("p")
      .map((node) => cleanText(node.text))
      .filter(
        (text): text is string =>
          Boolean(text) && text.length >= 40 && text.length <= 600 && !/cookie|privacy policy|all rights reserved/i.test(text),
      ),
  ).slice(0, 12);

  const images: ExtractedImage[] = [];
  const seenSrc = new Set<string>();
  for (const img of root.querySelectorAll("img")) {
    const raw =
      img.getAttribute("src") ||
      img.getAttribute("data-src") ||
      firstFromSrcset(img.getAttribute("srcset") || img.getAttribute("data-srcset"));
    if (!raw || SKIP_IMAGE.test(raw)) continue;
    const abs = absolutize(raw, baseUrl);
    if (!abs || !/^https?:\/\//i.test(abs) || seenSrc.has(abs)) continue;
    seenSrc.add(abs);
    images.push({
      src: abs,
      alt: cleanText(img.getAttribute("alt")) ?? title ?? "Business photo",
    });
    if (images.length >= 10) break;
  }

  const text = root.text.replace(/\s+/g, " ");
  const emails = unique([
    ...root.querySelectorAll('a[href^="mailto:"]').map((a) => a.getAttribute("href")?.replace(/^mailto:/i, "").split("?")[0] ?? ""),
    ...(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []),
  ].filter((email) => email && !/example\.com|sentry|wixpress|domain\.com/i.test(email))).slice(0, 3);

  const phones = unique([
    ...root.querySelectorAll('a[href^="tel:"]').map((a) => a.getAttribute("href")?.replace(/^tel:/i, "") ?? ""),
    ...(text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) ?? []),
  ].filter(Boolean)).slice(0, 3);

  const socialLinks: Array<{ label: string; href: string }> = [];
  const seenSocial = new Set<string>();
  for (const link of root.querySelectorAll("a[href]")) {
    const href = absolutize(link.getAttribute("href") ?? "", baseUrl);
    if (!href || !SOCIAL_HOST.test(href) || seenSocial.has(href)) continue;
    seenSocial.add(href);
    socialLinks.push({ label: socialLabel(href), href });
    if (socialLinks.length >= 6) break;
  }

  const navLabels = unique(
    root
      .querySelectorAll("nav a, header a")
      .map((a) => cleanText(a.text))
      .filter((text): text is string => Boolean(text) && text.length >= 2 && text.length <= 32),
  ).slice(0, 10);

  return { title, description, headings, paragraphs, images, emails, phones, socialLinks, navLabels };
}

export function siteModeFromHost(hostClass: string, recommendedService: string | null | undefined): "update" | "new" {
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY" || hostClass === "BLOCKED" || hostClass === "UNREACHABLE") {
    return "new";
  }
  if (recommendedService === "new_site") return "new";
  return "update";
}

function firstFromSrcset(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().split(/\s+/)[0];
  return first || null;
}

function absolutize(raw: string, baseUrl: string): string | null {
  try {
    if (raw.startsWith("data:")) return null;
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function socialLabel(href: string): string {
  if (/instagram/i.test(href)) return "Instagram";
  if (/facebook|fb\.com/i.test(href)) return "Facebook";
  if (/youtube|youtu\.be/i.test(href)) return "YouTube";
  if (/tiktok/i.test(href)) return "TikTok";
  if (/linkedin/i.test(href)) return "LinkedIn";
  if (/twitter|x\.com/i.test(href)) return "X";
  return "Social";
}
