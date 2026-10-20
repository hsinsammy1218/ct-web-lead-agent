import { describe, expect, it } from "vitest";
import type { LeadRecord, WorkRecord } from "@ct/db";
import { buildLeadPipeline } from "../lib/pipeline";

function lead(partial: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    displayName: "Harbor Boxing",
    nameNormalized: "harbor boxing",
    industrySlug: "boxing-gyms",
    industryName: "Boxing gyms",
    municipalityName: "Hartford",
    planningRegionId: "capitol",
    planningRegionName: "Capitol",
    leadStatus: "new",
    phone: null,
    website: {
      id: "site-1",
      originalUrl: "https://example.com",
      finalUrl: null,
      registrableDomain: "example.com",
      status: "OPERATOR_SITE",
      nameMentionWarning: false,
      allowDuplicate: false,
    },
    audit: {
      id: "audit-1",
      status: "queued",
      summary: "Queued",
      components: {
        performance: null,
        mobile: null,
        seo: null,
        ux: null,
        technical: null,
        design: null,
      },
      findings: [],
      auditedAt: null,
      screenshotPath: null,
    },
    score: null,
    ai: null,
    draft: null,
    notes: [],
    statusHistory: [],
    createdAt: "2026-10-19T18:00:00.000Z",
    submittedBy: "operator@local",
    ...partial,
  };
}

function job(partial: Partial<WorkRecord> & Pick<WorkRecord, "jobType" | "status">): WorkRecord {
  return {
    id: partial.id ?? `${partial.jobType}-${partial.status}`,
    jobType: partial.jobType,
    idempotencyKey: partial.idempotencyKey ?? partial.jobType,
    payload: partial.payload ?? { leadId: "lead-1" },
    status: partial.status,
    attempt: 0,
    maxAttempts: 3,
    runAfter: "2026-10-19T18:00:00.000Z",
    lockedUntil: null,
    lastError: partial.lastError ?? null,
    createdAt: "2026-10-19T18:00:00.000Z",
  };
}

describe("buildLeadPipeline", () => {
  it("marks website audit active while queued", () => {
    const pipeline = buildLeadPipeline(lead(), [job({ jobType: "website.audit", status: "queued" })]);
    expect(pipeline.active).toBe(true);
    expect(pipeline.steps.find((step) => step.id === "audit")?.status).toBe("active");
    expect(pipeline.steps[0]?.status).toBe("done");
    expect(pipeline.percent).toBeGreaterThan(0);
  });

  it("shows scored results as complete through scoring", () => {
    const pipeline = buildLeadPipeline(
      lead({
        audit: {
          id: "audit-1",
          status: "completed",
          summary: "Audit complete",
          components: {
            performance: 40,
            mobile: 50,
            seo: 45,
            ux: 40,
            technical: 55,
            design: 35,
          },
          findings: [],
          auditedAt: "2026-10-19T18:10:00.000Z",
          screenshotPath: null,
        },
        score: {
          quality: 42,
          need: 70,
          qualification: 80,
          contact: 20,
          confidence: 60,
          opportunity: 55,
          band: "qualified",
          recommendedService: "redesign",
          explanation: {
            formula: "test",
            quality: 42,
            need: 70,
            qualification: 80,
            contact: 20,
            confidence: 60,
            opportunity: 55,
            band: "qualified",
            weights: {},
            notes: ["Needs redesign"],
          },
        },
      }),
      [
        job({ jobType: "website.audit", status: "succeeded" }),
        job({ jobType: "lead.score", status: "succeeded" }),
      ],
    );
    expect(pipeline.steps.find((step) => step.id === "audit")?.status).toBe("done");
    expect(pipeline.steps.find((step) => step.id === "score")?.status).toBe("done");
    expect(pipeline.steps.find((step) => step.id === "assess")?.status).toBe("skipped");
    expect(pipeline.steps.find((step) => step.id === "generate")?.status).toBe("active");
    expect(pipeline.steps.find((step) => step.id === "generate")?.detail).toMatch(/approval/i);
    expect(pipeline.steps.find((step) => step.id === "publish")?.status).toBe("pending");
    expect(pipeline.steps.find((step) => step.id === "publish")?.detail).toMatch(/after the draft/i);
    expect(pipeline.headline).toMatch(/review/i);
    expect(pipeline.active).toBe(true);
  });

  it("does not block on failed optional AI assessment after scoring", () => {
    const pipeline = buildLeadPipeline(
      lead({
        audit: {
          id: "audit-1",
          status: "completed",
          summary: "Audit complete",
          components: {
            performance: 40,
            mobile: 50,
            seo: 45,
            ux: 40,
            technical: 55,
            design: 35,
          },
          findings: [],
          auditedAt: "2026-10-19T18:10:00.000Z",
          screenshotPath: null,
        },
        score: {
          quality: 42,
          need: 70,
          qualification: 80,
          contact: 20,
          confidence: 60,
          opportunity: 54,
          band: "review",
          recommendedService: "local_seo",
          explanation: {
            formula: "test",
            quality: 42,
            need: 70,
            qualification: 80,
            contact: 20,
            confidence: 60,
            opportunity: 54,
            band: "review",
            weights: {},
            notes: ["Needs local SEO"],
          },
        },
        draft: {
          status: "failed",
          path: null,
          previewPath: null,
          generatedAt: null,
          summary: "Waiting for approval",
          fixesApplied: [],
          recommendedService: "local_seo",
          error: "Auto-build stopped",
          repoUrl: null,
          deploymentUrl: null,
          githubRepo: null,
          vercelProjectId: null,
          publishStatus: null,
          testsPassed: null,
          testChecks: [],
        },
      }),
      [
        job({ jobType: "website.audit", status: "succeeded" }),
        job({
          jobType: "ai.assess",
          status: "failed",
          lastError: "AI response did not match the assessment schema",
        }),
        job({ jobType: "lead.score", status: "succeeded" }),
        job({ jobType: "site.generate", status: "succeeded" }),
        job({
          jobType: "site.publish",
          status: "failed",
          lastError: "Vercel deploy failed: 403",
        }),
      ],
    );
    expect(pipeline.steps.find((step) => step.id === "assess")?.status).toBe("skipped");
    expect(pipeline.steps.find((step) => step.id === "generate")?.status).toBe("active");
    expect(pipeline.steps.find((step) => step.id === "publish")?.status).toBe("pending");
    expect(pipeline.headline).toMatch(/review/i);
    expect(pipeline.steps.some((step) => step.status === "failed")).toBe(false);
  });
});
