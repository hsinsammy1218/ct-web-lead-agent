"use server";

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
  type PasteDraft,
} from "@ct/core";
import { currentOperator } from "../lib/auth";
import { getStore } from "../lib/store";

export type InterpretPasteResult =
  | { ok: true; draft: PasteDraft; message: string }
  | { ok: false; message: string };

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  return JSON.parse(raw);
}

export async function interpretPaste(paste: string): Promise<InterpretPasteResult> {
  await currentOperator();
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
    source === "ai"
      ? "Agent filled the fields from your paste."
      : "Filled what we could without AI — review before queueing.",
  ];
  if (pageFetched) parts.push("Pulled page title/metadata from the website.");
  if (source === "heuristic" && !process.env.OPENAI_API_KEY) {
    parts.push("Set OPENAI_API_KEY on the web service for fuller extraction.");
  }

  return { ok: true, draft, message: parts.join(" ") };
}
