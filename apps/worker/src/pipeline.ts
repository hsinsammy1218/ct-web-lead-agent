import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentPrompt,
  buildDraftSite,
  classifyHost,
  evaluateWebsite,
  scoreLead,
  shouldRequestAi,
  validateAssessment,
  websiteQuality,
  type PsiMetrics,
} from "@ct/core";
import {
  auditHtmlDirectory,
  draftSiteDirectory,
  screenshotDirectory,
  type MemoryStore,
  type SiteDraft,
  type SupabaseStore,
  type WorkRecord,
} from "@ct/db";
import { fetchPublicSite } from "./fetch-site.js";
import { publishGeneratedSite } from "./publish-site.js";

type Store = MemoryStore | SupabaseStore;
const AI_COST_USD = 0.004;

export async function processItem(store: Store, item: WorkRecord): Promise<void> {
  if (item.jobType === "website.audit") await runAudit(store, item);
  else if (item.jobType === "ai.assess") await runAi(store, item);
  else if (item.jobType === "lead.score") await runScore(store, item);
  else if (item.jobType === "site.generate") await runSiteGenerate(store, item);
  else if (item.jobType === "site.publish") await runSitePublish(store, item);
  else if (item.jobType === "retention.cleanup") {
    await store.retentionCleanup(Number(process.env.SCREENSHOT_RETENTION_DAYS ?? 90), screenshotDir());
  } else if (item.jobType === "reaudit.enqueue") {
    await store.enqueueDueReaudits(Number(process.env.REAUDIT_DAYS ?? 90));
  } else {
    throw new Error(`Unknown job ${item.jobType}`);
  }
}

async function runAudit(store: Store, item: WorkRecord): Promise<void> {
  const leadId = String(item.payload.leadId ?? "");
  const lead = await store.getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const initial = classifyHost(lead.website.originalUrl);
  let fetchResult = null;
  let psi: PsiMetrics | null = null;
  let browser = null;
  if (initial === "OPERATOR_SITE" || initial === "PLATFORM_SITE") {
    try {
      fetchResult = await fetchPublicSite(lead.website.originalUrl);
    } catch (error) {
      fetchResult = {
        finalUrl: null,
        statusCode: null,
        html: null,
        error: error instanceof Error ? error.message : "Fetch failed",
        blocked: false,
      };
    }
    if (fetchResult.finalUrl && fetchResult.html && !fetchResult.blocked && (fetchResult.statusCode ?? 500) < 400) {
      psi = await loadPsi(store, fetchResult.finalUrl);
      browser = await loadBrowser(fetchResult.finalUrl, lead.audit?.id ?? lead.id);
    }
  }
  const evaluation = evaluateWebsite({
    submittedUrl: lead.website.originalUrl,
    businessName: lead.displayName,
    initialHostClass: initial,
    fetch: fetchResult,
    psi,
    browser,
  });
  await store.updateWebsite(lead.id, {
    finalUrl: fetchResult?.finalUrl ?? null,
    status: evaluation.hostClass,
    nameMentionWarning: evaluation.nameMentioned === false,
  });
  const auditId = lead.audit?.id ?? lead.id;
  if (fetchResult?.html) {
    const htmlDir = auditHtmlDirectory();
    mkdirSync(htmlDir, { recursive: true });
    writeFileSync(path.join(htmlDir, `${auditId}.html`), fetchResult.html, "utf8");
  }
  await store.saveAudit(lead.id, {
    id: auditId,
    status: evaluation.auditStatus,
    summary: evaluation.summary,
    components: evaluation.components,
    findings: evaluation.findings,
    auditedAt: new Date().toISOString(),
    screenshotPath: browser?.screenshotCaptured ? `${auditId}.png` : null,
  });
  const threshold = Number(process.env.AI_QUALITY_THRESHOLD ?? 70);
  if (shouldRequestAi(evaluation.hostClass, websiteQuality(evaluation.components), threshold) && process.env.OPENAI_API_KEY) {
    const hash = createHash("sha256").update(JSON.stringify(evaluation.findings)).digest("hex");
    await store.enqueueJob("ai.assess", `ai:${lead.id}:${hash}`, { leadId: lead.id, inputHash: hash });
  } else {
    await store.enqueueJob("lead.score", `score:${lead.id}:${auditId}`, { leadId: lead.id });
  }
}

async function runAi(store: Store, item: WorkRecord): Promise<void> {
  const lead = await store.getLead(String(item.payload.leadId ?? ""));
  if (!lead?.audit) throw new Error("Audit evidence is missing");
  const decision = await store.budgetDecision(AI_COST_USD);
  if (!decision.ok) {
    await store.enqueueJob("lead.score", `score:${lead.id}:no-ai`, { leadId: lead.id });
    return;
  }
  const prompt = buildAssessmentPrompt({
    businessName: lead.displayName,
    municipality: lead.municipalityName,
    industry: lead.industryName,
    hostClass: lead.website.status,
    findings: lead.audit.findings,
  });
  const { text } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
    temperature: 0,
    system: `${ASSESSMENT_SYSTEM_PROMPT} Respond with one JSON object and no markdown.`,
    prompt,
  });
  const assessment = validateAssessment(parseJsonObject(text));
  await store.recordUsage("openai", "assessment", 1, AI_COST_USD);
  await store.saveAi(lead.id, assessment, String(item.payload.inputHash ?? lead.id));
  await store.enqueueJob("lead.score", `score:${lead.id}:ai`, { leadId: lead.id });
}

async function runScore(store: Store, item: WorkRecord): Promise<void> {
  const lead = await store.getLead(String(item.payload.leadId ?? ""));
  if (!lead) throw new Error("Lead not found");
  const components = lead.audit?.components ?? {
    performance: null,
    mobile: null,
    seo: null,
    ux: null,
    technical: null,
    design: null,
  };
  const completed = lead.audit?.status === "completed";
  const codes = new Set(lead.audit?.findings.map((finding) => finding.code) ?? []);
  const score = scoreLead({
    hostClass: lead.website.status,
    components,
    hasMunicipality: true,
    hasIndustry: true,
    hasName: lead.displayName.length > 1,
    normalizedName: lead.nameNormalized,
    denylist: store.referenceData().denylist,
    operatorPhone: Boolean(lead.phone),
    pagePhone: completed && !codes.has("no_click_to_call"),
    pageEmail: completed && !codes.has("no_email"),
    contactForm: completed && !codes.has("no_contact_form"),
    nameMentioned: completed ? !lead.website.nameMentionWarning : null,
  });
  if (lead.ai) score.recommendedService = lead.ai.recommended_service;
  await store.saveScore(lead.id, score);
  await store.saveSiteDraft(lead.id, emptyDraft({
    status: "queued",
    summary: "Draft website queued from the audit.",
    recommendedService: score.recommendedService,
  }));
  await store.enqueueJob("site.generate", `draft:${lead.id}:${lead.audit?.id ?? "score"}`, { leadId: lead.id });
}

async function runSiteGenerate(store: Store, item: WorkRecord): Promise<void> {
  const lead = await store.getLead(String(item.payload.leadId ?? ""));
  if (!lead) throw new Error("Lead not found");
  try {
    const sourceHtml = await loadSourceHtmlForLead(lead);
    const draft = buildDraftSite({
      leadId: lead.id,
      businessName: lead.displayName,
      municipality: lead.municipalityName,
      planningRegion: lead.planningRegionName,
      industry: lead.industryName,
      phone: lead.phone,
      currentUrl: lead.website.finalUrl ?? lead.website.originalUrl,
      hostClass: lead.website.status,
      findings: lead.audit?.findings ?? [],
      score: lead.score,
      ai: lead.ai,
      sourceHtml,
    });
    const dir = path.join(draftSiteDirectory(), lead.id);
    mkdirSync(dir, { recursive: true });
    const htmlPath = path.join(dir, "index.html");
    const briefPath = path.join(dir, "brief.json");
    writeFileSync(htmlPath, draft.html, "utf8");
    writeFileSync(briefPath, `${JSON.stringify(draft.brief, null, 2)}\n`, "utf8");
    for (const file of draft.files ?? []) {
      if (file.path === "index.html") continue;
      const full = path.join(dir, file.path);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, file.content, "utf8");
    }
    await store.saveSiteDraft(lead.id, emptyDraft({
      status: "publishing",
      path: htmlPath,
      previewPath: `/drafts/${lead.id}`,
      generatedAt: draft.brief.generatedAt,
      summary: draft.brief.summary,
      fixesApplied: draft.brief.fixesApplied,
      recommendedService: draft.brief.recommendedService,
      publishStatus: "queued",
    }));
    await store.enqueueJob("site.publish", `publish:${lead.id}:${draft.brief.generatedAt}`, { leadId: lead.id });
  } catch (error) {
    await store.saveSiteDraft(lead.id, emptyDraft({
      status: "failed",
      recommendedService: lead.score?.recommendedService ?? null,
      error: error instanceof Error ? error.message : "Draft generation failed",
      publishStatus: "failed",
    }));
    throw error;
  }
}

async function runSitePublish(store: Store, item: WorkRecord): Promise<void> {
  const lead = await store.getLead(String(item.payload.leadId ?? ""));
  if (!lead) throw new Error("Lead not found");
  const dir = path.join(draftSiteDirectory(), lead.id);
  const htmlPath = path.join(dir, "index.html");
  const briefPath = path.join(dir, "brief.json");
  const html = readFileSync(htmlPath, "utf8");
  const brief = JSON.parse(readFileSync(briefPath, "utf8")) as ReturnType<typeof buildDraftSite>["brief"];
  const extraFiles = ["styles.css", "coaches.html", "testimonials.html", "fight-back.html", "book.html"]
    .map((name) => {
      const full = path.join(dir, name);
      try {
        return { path: name, content: readFileSync(full, "utf8") };
      } catch {
        return null;
      }
    })
    .filter((file): file is { path: string; content: string } => Boolean(file));
  try {
    const published = await publishGeneratedSite({
      leadId: lead.id,
      businessName: lead.displayName,
      municipality: lead.municipalityName,
      html,
      brief,
      extraFiles,
      workDir: path.join(dir, "repo"),
    });
    await store.saveSiteDraft(lead.id, {
      status: published.draft.status ?? "ready",
      path: htmlPath,
      previewPath: `/drafts/${lead.id}`,
      generatedAt: brief.generatedAt,
      summary: published.draft.summary ?? brief.summary,
      fixesApplied: brief.fixesApplied,
      recommendedService: brief.recommendedService,
      error: published.draft.error ?? null,
      repoUrl: published.draft.repoUrl ?? null,
      deploymentUrl: published.draft.deploymentUrl ?? null,
      githubRepo: published.draft.githubRepo ?? null,
      vercelProjectId: published.draft.vercelProjectId ?? null,
      publishStatus: published.draft.publishStatus ?? "skipped",
      testsPassed: published.draft.testsPassed ?? null,
      testChecks: published.draft.testChecks ?? [],
    });
    if (published.draft.status === "failed") {
      throw new Error(published.draft.error ?? "Publish failed production checks");
    }
  } catch (error) {
    await store.saveSiteDraft(lead.id, emptyDraft({
      status: "failed",
      path: htmlPath,
      previewPath: `/drafts/${lead.id}`,
      generatedAt: brief.generatedAt,
      summary: brief.summary,
      fixesApplied: brief.fixesApplied,
      recommendedService: brief.recommendedService,
      publishStatus: "failed",
      error: error instanceof Error ? error.message : "Publish failed",
    }));
    throw error;
  }
}

function emptyDraft(patch: Partial<SiteDraft>): SiteDraft {
  return {
    status: "queued",
    path: null,
    previewPath: null,
    generatedAt: null,
    summary: null,
    fixesApplied: [],
    recommendedService: null,
    error: null,
    repoUrl: null,
    deploymentUrl: null,
    githubRepo: null,
    vercelProjectId: null,
    publishStatus: null,
    testsPassed: null,
    testChecks: [],
    ...patch,
  };
}

async function loadPsi(store: Store, pageUrl: string): Promise<PsiMetrics | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;
  const decision = await store.budgetDecision(0);
  if (!decision.ok) return null;
  const mobile = await psiStrategy(pageUrl, "mobile", key);
  const desktop = await psiStrategy(pageUrl, "desktop", key);
  await store.recordUsage("pagespeed", "runpagespeed", 2, 0);
  return {
    mobilePerformance: mobile.score,
    desktopPerformance: desktop.score,
    lcpMs: mobile.lcpMs,
    inpMs: mobile.inpMs,
    cls: mobile.cls,
  };
}

async function psiStrategy(pageUrl: string, strategy: "mobile" | "desktop", key: string): Promise<{ score: number | null; lcpMs: number | null; inpMs: number | null; cls: number | null }> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", pageUrl);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.append("category", "performance");
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return { score: null, lcpMs: null, inpMs: null, cls: null };
  const body = (await response.json()) as {
    lighthouseResult?: { categories?: { performance?: { score?: number } } };
    loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
  };
  const metrics = body.loadingExperience?.metrics ?? {};
  return {
    score: body.lighthouseResult?.categories?.performance?.score == null ? null : Math.round(body.lighthouseResult.categories.performance.score * 100),
    lcpMs: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    inpMs: metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    cls: metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile == null ? null : metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100,
  };
}

async function loadBrowser(pageUrl: string, auditId: string): Promise<{ horizontalOverflow: boolean; consoleErrorCount: number; hasVisibleTel: boolean; screenshotCaptured: boolean } | null> {
  if (process.env.PLAYWRIGHT_ENABLED !== "true") return null;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(pageUrl, { timeout: 20_000, waitUntil: "domcontentloaded" });
    const measured = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      tel: Boolean(document.querySelector('a[href^="tel:"]')),
    }));
    const dir = screenshotDir();
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${auditId}.png`) });
    return { horizontalOverflow: measured.overflow, consoleErrorCount: errors.length, hasVisibleTel: measured.tel, screenshotCaptured: true };
  } finally {
    await browser.close();
  }
}

async function loadSourceHtmlForLead(lead: {
  id: string;
  audit: { id: string } | null;
  website: { status: string; finalUrl: string | null; originalUrl: string };
}): Promise<string | null> {
  const auditId = lead.audit?.id ?? lead.id;
  const saved = path.join(auditHtmlDirectory(), `${auditId}.html`);
  if (existsSync(saved)) {
    try {
      return readFileSync(saved, "utf8");
    } catch {
      // fall through to re-fetch
    }
  }
  if (lead.website.status !== "OPERATOR_SITE" && lead.website.status !== "PLATFORM_SITE") {
    return null;
  }
  const url = lead.website.finalUrl ?? lead.website.originalUrl;
  try {
    const fetched = await fetchPublicSite(url);
    if (fetched.html && !fetched.blocked) {
      mkdirSync(auditHtmlDirectory(), { recursive: true });
      writeFileSync(saved, fetched.html, "utf8");
      return fetched.html;
    }
  } catch {
    return null;
  }
  return null;
}

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response was not JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function screenshotDir(): string {
  return screenshotDirectory();
}
