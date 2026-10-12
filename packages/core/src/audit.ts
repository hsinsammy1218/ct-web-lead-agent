import { createHash } from "node:crypto";
import { parse, type HTMLElement } from "node-html-parser";
import { normalizeLookup } from "./reference.js";
import type { Finding, HostClass, QualityComponents } from "./types.js";
import { classifyHost } from "./url.js";

export interface PsiMetrics {
  mobilePerformance: number | null;
  desktopPerformance: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

export interface BrowserEvidence {
  horizontalOverflow: boolean;
  consoleErrorCount: number;
  hasVisibleTel: boolean;
  screenshotCaptured: boolean;
}

export interface FetchObservation {
  finalUrl: string | null;
  statusCode: number | null;
  html: string | null;
  error: string | null;
  blocked: boolean;
}

export interface AuditEvaluation {
  hostClass: HostClass;
  components: QualityComponents;
  findings: Finding[];
  nameMentioned: boolean | null;
  pagePhone: boolean;
  pageEmail: boolean;
  contactForm: boolean;
  htmlSha256: string | null;
  summary: string;
  auditStatus: "completed" | "failed" | "blocked" | "skipped";
}

const EMPTY_COMPONENTS: QualityComponents = {
  performance: null,
  mobile: null,
  seo: null,
  ux: null,
  technical: null,
  design: null,
};

export function evaluateWebsite(input: {
  submittedUrl: string;
  businessName: string;
  initialHostClass: HostClass;
  fetch: FetchObservation | null;
  psi: PsiMetrics | null;
  browser: BrowserEvidence | null;
}): AuditEvaluation {
  const hostClass = resolveHost(input.initialHostClass, input.fetch);
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY") {
    return {
      hostClass,
      components: EMPTY_COMPONENTS,
      findings: [
        {
          category: "ux",
          code: "not_an_official_site",
          severity: "info",
          source: "measured",
          evidence: { url: input.submittedUrl, hostClass },
        },
      ],
      nameMentioned: null,
      pagePhone: false,
      pageEmail: false,
      contactForm: false,
      htmlSha256: null,
      summary:
        hostClass === "SOCIAL_ONLY"
          ? "The submitted URL is a social profile, so it was not audited as a company website."
          : "The submitted URL is a directory listing, so it was not audited as a company website.",
      auditStatus: "skipped",
    };
  }
  if (!input.fetch || input.fetch.blocked || hostClass === "BLOCKED") {
    return failed(hostClass === "UNREACHABLE" ? "UNREACHABLE" : "BLOCKED", input.fetch, "blocked");
  }
  if (input.fetch.error || input.fetch.statusCode == null || input.fetch.statusCode >= 400 || !input.fetch.html) {
    return failed("UNREACHABLE", input.fetch, "failed");
  }

  const root = parse(input.fetch.html);
  const text = root.text.replace(/\s+/g, " ").trim();
  const nameMentioned = pageMentionsName(input.businessName, text);
  const seo = seoScore(root);
  const ux = uxScore(root, text);
  const technical = technicalScore(root, input.fetch);
  const mobile = mobileScore(root, input.browser);
  const performance = input.psi?.mobilePerformance ?? null;
  const components: QualityComponents = {
    performance,
    mobile,
    seo: seo.score,
    ux: ux.score,
    technical: technical.score,
    design: null,
  };
  const findings = [
    ...seo.findings,
    ...ux.findings,
    ...technical.findings,
    ...mobileFindings(root, input.browser),
    ...psiFindings(input.psi),
  ];
  if (!nameMentioned) {
    findings.push({
      category: "ux",
      code: "business_name_not_on_page",
      severity: "moderate",
      source: "measured",
      evidence: { businessName: input.businessName },
    });
  }
  return {
    hostClass,
    components,
    findings,
    nameMentioned,
    pagePhone: ux.pagePhone,
    pageEmail: ux.pageEmail,
    contactForm: ux.contactForm,
    htmlSha256: createHash("sha256").update(input.fetch.html).digest("hex"),
    summary: summarize(components, nameMentioned),
    auditStatus: "completed",
  };
}

function resolveHost(initial: HostClass, fetch: FetchObservation | null): HostClass {
  if (fetch?.blocked) return "BLOCKED";
  if (!fetch) return initial === "OPERATOR_SITE" || initial === "PLATFORM_SITE" ? "UNREACHABLE" : initial;
  if (fetch.finalUrl) {
    const finalClass = classifyHost(fetch.finalUrl);
    if (finalClass !== "OPERATOR_SITE") return finalClass;
  }
  return initial;
}

function failed(
  hostClass: HostClass,
  fetch: FetchObservation | null,
  auditStatus: "failed" | "blocked",
): AuditEvaluation {
  return {
    hostClass,
    components: EMPTY_COMPONENTS,
    findings: [
      {
        category: "technical",
        code: auditStatus === "blocked" ? "access_blocked" : "fetch_failed",
        severity: "critical",
        source: "measured",
        evidence: {
          statusCode: fetch?.statusCode ?? null,
          error: fetch?.error ?? "No response",
        },
      },
    ],
    nameMentioned: null,
    pagePhone: false,
    pageEmail: false,
    contactForm: false,
    htmlSha256: null,
    summary:
      auditStatus === "blocked"
        ? "The site blocked automated access. That is not treated as a poor website."
        : "The site could not be fetched. Quality was left blank.",
    auditStatus,
  };
}

function seoScore(root: HTMLElement): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 0;
  const title = root.querySelector("title")?.text.trim() ?? "";
  if (title) score += 25;
  else findings.push(finding("seo", "missing_title", "critical", { title }));
  if (title.length >= 15 && title.length <= 65) score += 10;
  else if (title) findings.push(finding("seo", "title_length", "moderate", { length: title.length }));
  const description = meta(root, "description");
  if (description) score += 25;
  else findings.push(finding("seo", "missing_meta_description", "moderate", {}));
  const h1Count = root.querySelectorAll("h1").length;
  if (h1Count === 1) score += 15;
  else findings.push(finding("seo", "heading_structure", "moderate", { h1Count }));
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (canonical) score += 10;
  else findings.push(finding("seo", "missing_canonical", "info", {}));
  const robots = meta(root, "robots");
  if (!/noindex/i.test(robots)) score += 10;
  else findings.push(finding("seo", "noindex", "critical", { robots }));
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').map((node) => node.text);
  const hasLocalBusiness = jsonLd.some((block) => /LocalBusiness/i.test(block));
  if (hasLocalBusiness) score += 15;
  else findings.push(finding("seo", "missing_local_business_schema", "info", {}));
  return { score: Math.min(100, score), findings };
}

function uxScore(root: HTMLElement, text: string): {
  score: number;
  findings: Finding[];
  pagePhone: boolean;
  pageEmail: boolean;
  contactForm: boolean;
} {
  const findings: Finding[] = [];
  let score = 0;
  const pagePhone = root.querySelectorAll('a[href^="tel:"]').length > 0;
  const pageEmail =
    root.querySelectorAll('a[href^="mailto:"]').length > 0 || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const contactForm = root.querySelectorAll("form").some((form) => {
    const blob = `${form.getAttribute("action") ?? ""} ${form.getAttribute("id") ?? ""} ${form.text}`.toLowerCase();
    return /contact|quote|estimate|book|appointment/.test(blob) || form.querySelector("textarea") != null;
  });
  const hasNav = root.querySelector("nav") != null;
  const hasAddress = /\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)/i.test(text);
  if (pagePhone) score += 25;
  else findings.push(finding("ux", "no_click_to_call", "moderate", {}));
  if (pageEmail) score += 15;
  else findings.push(finding("ux", "no_email", "info", {}));
  if (contactForm) score += 30;
  else findings.push(finding("ux", "no_contact_form", "moderate", {}));
  if (hasNav) score += 15;
  else findings.push(finding("ux", "no_nav", "moderate", {}));
  if (hasAddress) score += 15;
  else findings.push(finding("ux", "no_street_address", "info", {}));
  return { score, findings, pagePhone, pageEmail, contactForm };
}

function technicalScore(root: HTMLElement, fetch: FetchObservation): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 0;
  const https = fetch.finalUrl?.startsWith("https://") ?? false;
  if (https) score += 30;
  else findings.push(finding("technical", "not_https", "critical", { finalUrl: fetch.finalUrl }));
  if (fetch.statusCode != null && fetch.statusCode < 400) score += 20;
  if (root.querySelector("html")?.getAttribute("lang")) score += 10;
  else findings.push(finding("technical", "missing_lang", "info", {}));
  const images = root.querySelectorAll("img");
  const missingAlt = images.filter((image) => !image.getAttribute("alt")).length;
  if (images.length === 0 || missingAlt === 0) score += 20;
  else findings.push(finding("technical", "images_missing_alt", "moderate", { missingAlt, images: images.length }));
  const viewport = root.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  if (/width=device-width/i.test(viewport)) score += 20;
  else findings.push(finding("technical", "missing_viewport", "critical", { viewport }));
  return { score, findings };
}

function mobileScore(root: HTMLElement, browser: BrowserEvidence | null): number {
  if (browser) {
    let score = 70;
    if (browser.horizontalOverflow) score -= 40;
    if (browser.consoleErrorCount > 0) score -= Math.min(20, browser.consoleErrorCount * 5);
    if (browser.hasVisibleTel) score += 15;
    const viewport = root.querySelector('meta[name="viewport"]');
    if (!viewport) score -= 15;
    return Math.max(0, Math.min(100, score));
  }
  let score = 0;
  const viewport = root.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  if (/width=device-width/i.test(viewport)) score += 50;
  if (root.querySelector('a[href^="tel:"], button')) score += 25;
  if (!/width\s*:\s*\d{4,}px/i.test(root.toString())) score += 25;
  return score;
}

function mobileFindings(root: HTMLElement, browser: BrowserEvidence | null): Finding[] {
  const findings: Finding[] = [];
  if (browser?.horizontalOverflow) {
    findings.push(finding("mobile", "horizontal_overflow", "critical", { horizontalOverflow: true }));
  }
  if (browser && browser.consoleErrorCount > 0) {
    findings.push(
      finding("technical", "console_errors", "moderate", { count: browser.consoleErrorCount }),
    );
  }
  if (!root.querySelector('meta[name="viewport"]')) {
    findings.push(finding("mobile", "missing_viewport", "critical", {}));
  }
  return findings;
}

function psiFindings(psi: PsiMetrics | null): Finding[] {
  if (!psi) {
    return [finding("performance", "psi_not_run", "info", { reason: "PageSpeed Insights was not called" })];
  }
  return [
    finding("performance", "psi_metrics", "info", {
      mobilePerformance: psi.mobilePerformance,
      desktopPerformance: psi.desktopPerformance,
      lcpMs: psi.lcpMs,
      inpMs: psi.inpMs,
      cls: psi.cls,
    }),
  ];
}

function pageMentionsName(businessName: string, text: string): boolean {
  const normalizedText = normalizeLookup(text);
  const normalizedName = normalizeLookup(businessName);
  if (normalizedName.length >= 4 && normalizedText.includes(normalizedName)) return true;
  const tokens = normalizedName.split(" ").filter((token) => token.length > 3);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => normalizedText.includes(token)).length;
  return hits >= Math.min(2, tokens.length) && hits / tokens.length >= 0.5;
}

function summarize(components: QualityComponents, nameMentioned: boolean): string {
  const parts = [
    components.performance != null ? `mobile performance ${components.performance}` : "performance not measured",
    components.seo != null ? `SEO ${components.seo}` : null,
    components.ux != null ? `UX ${components.ux}` : null,
    components.technical != null ? `technical ${components.technical}` : null,
    nameMentioned ? "the business name appears on the page" : "the business name was not found on the page",
  ].filter(Boolean);
  return `Measured ${parts.join("; ")}. Design was not scored.`;
}

function meta(root: HTMLElement, name: string): string {
  return root.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() ?? "";
}

function finding(
  category: Finding["category"],
  code: string,
  severity: Finding["severity"],
  evidence: Record<string, unknown>,
): Finding {
  return { category, code, severity, evidence, source: "measured" };
}
