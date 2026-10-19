"use server";

import { redirect } from "next/navigation";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  PASTE_ENRICHMENT_SYSTEM_PROMPT,
  buildPasteEnrichmentPrompt,
  extractCandidateUrls,
  fetchPageHints,
  heuristicPasteDraft,
  normalizePasteDraft,
  pasteDraftSchema,
  validateSubmission,
  type LeadStatus,
  type PasteDraft,
} from "@ct/core";
import { currentOperator } from "../lib/auth";
import { getStore } from "../lib/store";

async function actor(): Promise<string> {
  return currentOperator();
}

export type InterpretPasteResult =
  | { ok: true; draft: PasteDraft; message: string }
  | { ok: false; message: string };

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  return JSON.parse(raw);
}

export async function interpretPaste(paste: string): Promise<InterpretPasteResult> {
  await actor();
  const text = paste.trim();
  if (!text) {
    return { ok: false, message: "Paste a website URL or business details first." };
  }

  const data = getStore().referenceData();
  const urls = extractCandidateUrls(text);
  let pageFetched = false;
  let hints = null;
  if (urls[0]) {
    try {
      hints = await fetchPageHints(urls[0]);
      pageFetched = Boolean(hints);
    } catch {
      hints = null;
    }
  }

  let draft: PasteDraft | null = null;
  let source: "ai" | "heuristic" = "heuristic";
  if (process.env.OPENAI_API_KEY) {
    try {
      const industries = data.industries
        .filter((industry) => industry.enabled)
        .map((industry) => ({ slug: industry.slug, displayName: industry.displayName }));
      const { text: response } = await generateText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
        temperature: 0,
        system: `${PASTE_ENRICHMENT_SYSTEM_PROMPT} Respond with one JSON object and no markdown.`,
        prompt: buildPasteEnrichmentPrompt({
          paste: text,
          hints,
          industries,
          municipalities: data.municipalities.map((municipality) => municipality.name),
        }),
      });
      const parsed = pasteDraftSchema.safeParse(parseJsonObject(response));
      if (parsed.success) {
        draft = parsed.data;
        source = "ai";
      }
    } catch {
      draft = null;
    }
  }

  if (!draft) {
    draft = heuristicPasteDraft(text, data, hints);
  }

  draft = normalizePasteDraft(draft, data);
  if (!draft.websiteUrl && urls[0]) draft = { ...draft, websiteUrl: urls[0] };

  const filled = [draft.businessName, draft.municipality, draft.industry, draft.websiteUrl].filter(Boolean).length;
  if (filled === 0) {
    return {
      ok: false,
      message: "Could not extract lead fields from that paste. Add a URL or a town and business name.",
    };
  }

  const parts = [
    source === "ai" ? "Agent filled the fields from your paste." : "Filled what we could without AI — review before queueing.",
  ];
  if (pageFetched) parts.push("Pulled page title/metadata from the website.");
  if (source === "heuristic" && !process.env.OPENAI_API_KEY) {
    parts.push("Set OPENAI_API_KEY on the web service for fuller extraction.");
  }

  return { ok: true, draft, message: parts.join(" ") };
}

export async function submitWebsite(formData: FormData): Promise<void> {
  const email = await actor();
  const store = getStore();
  const validated = validateSubmission(
    {
      businessName: String(formData.get("business_name") ?? ""),
      municipality: String(formData.get("municipality") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      websiteUrl: String(formData.get("website_url") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      note: String(formData.get("note") ?? ""),
    },
    store.referenceData(),
  );
  if (!validated.ok) redirect(`/leads/new?error=${encodeURIComponent(validated.message)}`);
  const result = await store.submit(validated.value, email, formData.get("allow_duplicate") === "on");
  if (!result.ok) redirect(`/leads/new?error=${encodeURIComponent(result.message)}&duplicate=${result.leadId ?? ""}`);
  redirect(`/leads/${result.leadId}`);
}

export async function importCsv(formData: FormData): Promise<void> {
  const email = await actor();
  const file = formData.get("file");
  const pasted = String(formData.get("csv") ?? "");
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  const result = await getStore().importCsv(text, email, formData.get("allow_duplicate") === "on");
  const summary = result.results.map((row) => row.message).join(" | ").slice(0, 500);
  redirect(`/leads/import?accepted=${result.accepted}&rejected=${result.rejected}&summary=${encodeURIComponent(summary)}`);
}

export async function addNote(formData: FormData): Promise<void> {
  const email = await actor();
  const id = String(formData.get("lead_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body) await getStore().addNote(id, body, email);
  redirect(`/leads/${id}`);
}

export async function setLeadStatus(formData: FormData): Promise<void> {
  const email = await actor();
  const id = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("status") ?? "new") as LeadStatus;
  await getStore().setStatus(id, status, email);
  redirect(`/leads/${id}`);
}

export async function reaudit(formData: FormData): Promise<void> {
  await actor();
  const id = String(formData.get("lead_id") ?? "");
  const lead = await getStore().getLead(id);
  if (!lead) redirect("/leads");
  await getStore().enqueueJob("website.audit", `reaudit:${lead.website.id}:${Date.now()}`, {
    leadId: lead.id,
    websiteId: lead.website.id,
  });
  redirect(`/leads/${id}?queued=1`);
}

export async function rescore(formData: FormData): Promise<void> {
  await actor();
  const id = String(formData.get("lead_id") ?? "");
  await getStore().enqueueJob("lead.score", `rescore:${id}:${Date.now()}`, { leadId: id });
  redirect(`/leads/${id}?queued=1`);
}

export async function regenerateDraft(formData: FormData): Promise<void> {
  await actor();
  const id = String(formData.get("lead_id") ?? "");
  const store = getStore();
  const lead = await store.getLead(id);
  if (!lead) redirect("/leads");
  await store.saveSiteDraft(id, {
    status: "queued",
    path: null,
    previewPath: null,
    generatedAt: null,
    summary: "Draft website queued again.",
    fixesApplied: [],
    recommendedService: lead.score?.recommendedService ?? null,
    error: null,
    repoUrl: null,
    deploymentUrl: null,
    githubRepo: null,
    vercelProjectId: null,
    publishStatus: "queued",
    testsPassed: null,
    testChecks: [],
  });
  await store.enqueueJob("site.generate", `draft:${id}:${Date.now()}`, { leadId: id });
  redirect(`/leads/${id}?queued=1`);
}
