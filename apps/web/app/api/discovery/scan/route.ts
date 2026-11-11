import {
  DISCOVERY_SCAN_COST_USD,
  isDiscoveryOpportunity,
  runDiscoveryScan,
  validateSubmission,
} from "@ct/core";
import { currentOperator } from "../../../../lib/auth";
import { getReferenceData, getStore, storeError } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ScanBody {
  municipality?: string;
  industry?: string;
  maxResults?: number;
  probeOutdated?: boolean;
  /** When true, queue weak/outdated websites into the normal audit pipeline. */
  enqueue?: boolean;
  /** Include skip-class (healthy-looking) operator sites in the JSON response. */
  includeSkipped?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return json(
        {
          error:
            "Set GOOGLE_PLACES_API_KEY (Places API New) on the Vercel project. Enable Places API (New) in Google Cloud.",
        },
        503,
      );
    }

    const body = (await request.json().catch(() => ({}))) as ScanBody;
    const municipality = String(body.municipality ?? "").trim();
    const industry = String(body.industry ?? "").trim();
    if (!municipality || !industry) {
      return json({ error: "municipality and industry are required" }, 400);
    }

    const store = getStore();
    const budget = await store.budgetDecision(DISCOVERY_SCAN_COST_USD);
    if (!budget.ok) {
      return json({ error: budget.reason }, 402);
    }

    const reference = await getReferenceData();
    const scan = await runDiscoveryScan({
      municipality,
      industry,
      maxResults: body.maxResults,
      probeOutdated: body.probeOutdated !== false,
      apiKey,
      reference,
    });
    await store.recordUsage("google_places", "searchText", 1, DISCOVERY_SCAN_COST_USD);

    const opportunities = scan.candidates.filter((item) => isDiscoveryOpportunity(item.opportunity));
    const responseCandidates = body.includeSkipped ? scan.candidates : opportunities;

    const enqueued: Array<{ businessName: string; leadId: string | null; message: string; skipped?: boolean }> = [];
    if (body.enqueue) {
      const email = await currentOperator();
      for (const candidate of opportunities) {
        if (!candidate.enqueueable || !candidate.websiteUrl) {
          enqueued.push({
            businessName: candidate.businessName,
            leadId: null,
            message: "No enqueueable website URL (add manually from Maps if needed)",
            skipped: true,
          });
          continue;
        }
        const validated = validateSubmission(
          {
            businessName: candidate.businessName,
            municipality: scan.municipality,
            industry: scan.industrySlug,
            websiteUrl: candidate.websiteUrl,
            phone: candidate.phone ?? undefined,
            note: `Discovery: ${candidate.opportunity}. ${candidate.reason}`,
          },
          reference,
        );
        if (!validated.ok) {
          enqueued.push({
            businessName: candidate.businessName,
            leadId: null,
            message: validated.message,
            skipped: true,
          });
          continue;
        }
        const result = await store.submit(validated.value, email, false);
        enqueued.push({
          businessName: candidate.businessName,
          leadId: result.leadId ?? null,
          message: result.message,
          skipped: result.skipped,
        });
      }
    }

    return json({
      query: scan.query,
      municipality: scan.municipality,
      industry: scan.industrySlug,
      industryName: scan.industryName,
      summary: scan.summary,
      candidates: responseCandidates,
      enqueued: body.enqueue ? enqueued : undefined,
    });
  } catch (caught) {
    return json({ error: storeError(caught, "Discovery scan failed").message }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
