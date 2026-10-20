import type { LeadRecord, WorkRecord } from "@ct/db";

export type PipelineStepStatus = "done" | "active" | "pending" | "failed" | "skipped";

export interface PipelineStep {
  id: string;
  label: string;
  detail: string;
  status: PipelineStepStatus;
}

export interface LeadPipeline {
  steps: PipelineStep[];
  active: boolean;
  headline: string;
  subline: string;
  percent: number;
}

function jobsForLead(leadId: string, work: WorkRecord[]): WorkRecord[] {
  return work.filter((job) => String(job.payload.leadId ?? "") === leadId);
}

function latestJob(jobs: WorkRecord[], type: string): WorkRecord | undefined {
  return jobs.find((job) => job.jobType === type);
}

function jobStepStatus(
  job: WorkRecord | undefined,
  doneWhen: boolean,
  options?: { skipWhen?: boolean; failedWhen?: boolean },
): PipelineStepStatus {
  if (options?.failedWhen) return "failed";
  if (options?.skipWhen) return "skipped";
  if (doneWhen) return "done";
  if (!job) return "pending";
  if (job.status === "failed") return "failed";
  if (job.status === "running") return "active";
  if (job.status === "queued") return "active";
  if (job.status === "succeeded") return "done";
  return "pending";
}

export function buildLeadPipeline(lead: LeadRecord, work: WorkRecord[]): LeadPipeline {
  const jobs = jobsForLead(lead.id, work);
  const auditJob = latestJob(jobs, "website.audit");
  const aiJob = latestJob(jobs, "ai.assess");
  const scoreJob = latestJob(jobs, "lead.score");
  const generateJob = latestJob(jobs, "site.generate");
  const publishJob = latestJob(jobs, "site.publish");

  const auditFailed = lead.audit?.status === "failed" || auditJob?.status === "failed";
  const auditBlocked = lead.audit?.status === "blocked" || lead.website.status === "BLOCKED";
  const auditDone =
    lead.audit?.status === "completed" ||
    lead.audit?.status === "skipped" ||
    auditBlocked ||
    (Boolean(lead.audit) && lead.audit?.status !== "queued");

  const aiFailed = aiJob?.status === "failed" && !lead.ai;
  const aiSkipped =
    Boolean(lead.score) &&
    !lead.ai &&
    (aiJob?.status === "succeeded" || (auditDone && !aiJob));
  const aiDone = Boolean(lead.ai);
  const scoreDone = Boolean(lead.score);
  const draftQueued = lead.draft?.status === "queued" || lead.draft?.status === "publishing";
  const draftDone =
    lead.draft?.status === "ready" ||
    lead.draft?.status === "publishing" ||
    Boolean(lead.draft?.path) ||
    Boolean(lead.draft?.deploymentUrl);
  const draftFailed = lead.draft?.status === "failed";
  const publishDone =
    lead.draft?.publishStatus === "published" || Boolean(lead.draft?.deploymentUrl);
  const publishSkipped = lead.draft?.publishStatus === "skipped";
  const publishFailed = lead.draft?.publishStatus === "failed";

  const steps: PipelineStep[] = [
    {
      id: "submitted",
      label: "Submitted",
      detail: lead.createdAt.slice(0, 16).replace("T", " "),
      status: "done",
    },
    {
      id: "audit",
      label: "Website audit",
      detail: auditBlocked
        ? "Fetch blocked"
        : auditFailed
          ? lead.audit?.summary || operatorFacingDetail(auditJob?.lastError) || "Audit failed"
          : auditDone
            ? lead.audit?.summary || "Evidence collected"
            : auditJob?.status === "running"
              ? "Fetching and measuring the site…"
              : auditJob?.lastError
                ? operatorFacingDetail(auditJob.lastError)
                : "Waiting for the worker to start",
      status: jobStepStatus(auditJob, auditDone, {
        failedWhen: auditFailed,
      }),
    },
    {
      id: "assess",
      label: "Assessment",
      detail: aiFailed
        ? operatorFacingDetail(aiJob?.lastError) || "Assessment failed"
        : aiSkipped
          ? "Skipped — scored from measured evidence"
          : aiDone
            ? "Written notes ready"
            : aiJob?.status === "running" || aiJob?.status === "queued"
              ? "Reviewing findings…"
              : auditDone
                ? "Queued after audit when needed"
                : "After the audit",
      status: jobStepStatus(aiJob, aiDone, { skipWhen: aiSkipped, failedWhen: aiFailed }),
    },
    {
      id: "score",
      label: "Scoring",
      detail: scoreDone
        ? `${lead.score?.band?.replaceAll("_", " ") ?? "scored"} · opportunity ${lead.score?.opportunity ?? "—"}`
        : scoreJob
          ? "Calculating opportunity…"
          : "After assessment",
      status: jobStepStatus(scoreJob, scoreDone, {
        failedWhen: scoreJob?.status === "failed",
      }),
    },
    {
      id: "generate",
      label: "Draft website",
      detail: draftFailed
        ? lead.draft?.error || "Generation failed"
        : draftDone
          ? lead.draft?.summary || "Draft ready"
          : draftQueued || generateJob
            ? "Building the improved site…"
            : "After scoring",
      status: jobStepStatus(generateJob, draftDone, {
        failedWhen: draftFailed || generateJob?.status === "failed",
      }),
    },
    {
      id: "publish",
      label: "Live publish",
      detail: publishFailed
        ? lead.draft?.error || "Publish failed"
        : publishSkipped
          ? "Publish skipped"
          : publishDone
            ? lead.draft?.deploymentUrl || "Deployed"
            : publishJob || lead.draft?.publishStatus === "queued"
              ? "Creating repo and deploying…"
              : "After the draft is ready",
      status: jobStepStatus(publishJob, publishDone, {
        skipWhen: publishSkipped,
        failedWhen: publishFailed || publishJob?.status === "failed",
      }),
    },
  ];

  // Ensure only one active step is highlighted when several are pending.
  let sawActive = false;
  for (const step of steps) {
    if (step.status === "active") {
      if (sawActive) step.status = "pending";
      else sawActive = true;
    }
  }
  if (!sawActive) {
    const next = steps.find((step) => step.status === "pending");
    if (next) {
      const nextIndex = steps.indexOf(next);
      const priorDone = steps
        .slice(0, nextIndex)
        .every((step) => step.status === "done" || step.status === "skipped");
      const related =
        next.id === "audit"
          ? auditJob
          : next.id === "assess"
            ? aiJob
            : next.id === "score"
              ? scoreJob
              : next.id === "generate"
                ? generateJob
                : next.id === "publish"
                  ? publishJob
                  : undefined;
      const relatedActive = related?.status === "queued" || related?.status === "running";
      const impliedActive =
        (next.id === "audit" && lead.audit?.status === "queued") ||
        (next.id === "generate" && draftQueued) ||
        (next.id === "publish" && lead.draft?.publishStatus === "queued");
      if (priorDone && (relatedActive || impliedActive)) {
        next.status = "active";
      }
    }
  }

  const doneCount = steps.filter((step) => step.status === "done" || step.status === "skipped").length;
  const failed = steps.some((step) => step.status === "failed");
  const active = steps.some((step) => step.status === "active");
  const percent = Math.round((doneCount / steps.length) * 100);
  const current = steps.find((step) => step.status === "active") ?? steps.find((step) => step.status === "failed");

  let headline = "Audit complete";
  let subline = "Results below are ready for review.";
  if (failed) {
    headline = "Pipeline needs attention";
    subline = current?.detail || "A step failed. Retry from the actions below.";
  } else if (active) {
    headline = `${current?.label ?? "Work"} in progress`;
    subline = current?.detail || "The worker is processing this lead.";
  } else if (percent < 100 && scoredIncomplete(steps)) {
    headline = "Waiting to continue";
    subline = "Later steps start after earlier ones finish.";
  } else if (percent < 100) {
    headline = "Results ready";
    subline = "Core audit and scoring are done. Draft and publish run when queued.";
  }

  return { steps, active, headline, subline, percent };
}

function scoredIncomplete(steps: PipelineStep[]): boolean {
  const score = steps.find((step) => step.id === "score");
  return score?.status !== "done" && score?.status !== "skipped";
}

function shortError(message: string | null | undefined): string {
  if (!message) return "";
  const firstLine = message.split("\n").find((line) => line.trim()) ?? message;
  return firstLine.replace(/\s+/g, " ").trim().slice(0, 140);
}

function operatorFacingDetail(message: string | null | undefined): string {
  if (!message) return "";
  if (/playwright|browsertype|chromium|executable doesn't exist|ms-playwright/i.test(message)) {
    return "The audit browser on the worker isn’t ready yet. It will retry on the next run.";
  }
  if (/assessment schema|did not match the assessment/i.test(message)) {
    return "Written assessment needs a cleaner model response. Scoring can continue from measured evidence.";
  }
  return `Retrying after a worker hiccup: ${shortError(message)}`;
}
