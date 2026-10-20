"use server";

import { redirect } from "next/navigation";
import { validateSubmission, type LeadStatus } from "@ct/core";
import { currentOperator } from "../lib/auth";
import { getStore } from "../lib/store";

async function actor(): Promise<string> {
  return currentOperator();
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
  if (result.skipped && result.leadId) {
    redirect(`/leads/${result.leadId}?skipped=1&reason=${encodeURIComponent(result.message)}`);
  }
  if (!result.ok) {
    redirect(`/leads/new?error=${encodeURIComponent(result.message)}&duplicate=${result.leadId ?? ""}`);
  }
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

/** Operator approval after reviewing the audit — queues draft website build only. */
export async function approveBuildWebsite(formData: FormData): Promise<void> {
  await actor();
  const id = String(formData.get("lead_id") ?? "");
  const store = getStore();
  const lead = await store.getLead(id);
  if (!lead) redirect("/leads");
  if (!lead.score) {
    redirect(`/leads/${id}?error=${encodeURIComponent("Score the audit before approving a website build.")}`);
  }
  await store.saveSiteDraft(id, {
    status: "queued",
    path: null,
    previewPath: null,
    generatedAt: null,
    summary: "Website build approved — queued for the worker.",
    fixesApplied: [],
    recommendedService: lead.score?.recommendedService ?? null,
    error: null,
    repoUrl: null,
    deploymentUrl: null,
    githubRepo: null,
    vercelProjectId: null,
    publishStatus: null,
    testsPassed: null,
    testChecks: [],
  });
  await store.enqueueJob("site.generate", `draft:${id}:${Date.now()}`, { leadId: id });
  redirect(`/leads/${id}?queued=1`);
}

/** Explicit live publish after the local draft is ready. */
export async function publishWebsite(formData: FormData): Promise<void> {
  await actor();
  const id = String(formData.get("lead_id") ?? "");
  const store = getStore();
  const lead = await store.getLead(id);
  if (!lead) redirect("/leads");
  const draft = lead.draft;
  if (!draft?.path && draft?.status !== "ready") {
    redirect(`/leads/${id}?error=${encodeURIComponent("Build and review the draft website before publishing.")}`);
  }
  await store.saveSiteDraft(id, {
    status: "publishing",
    path: draft?.path ?? null,
    previewPath: draft?.previewPath ?? `/drafts/${id}`,
    generatedAt: draft?.generatedAt ?? null,
    summary: draft?.summary ?? "Publishing approved — queued for deploy.",
    fixesApplied: draft?.fixesApplied ?? [],
    recommendedService: draft?.recommendedService ?? lead.score?.recommendedService ?? null,
    error: null,
    repoUrl: draft?.repoUrl ?? null,
    deploymentUrl: draft?.deploymentUrl ?? null,
    githubRepo: draft?.githubRepo ?? null,
    vercelProjectId: draft?.vercelProjectId ?? null,
    publishStatus: "queued",
    testsPassed: draft?.testsPassed ?? null,
    testChecks: draft?.testChecks ?? [],
  });
  await store.enqueueJob("site.publish", `publish:${id}:${Date.now()}`, { leadId: id });
  redirect(`/leads/${id}?queued=1`);
}

/** @deprecated alias — prefer approveBuildWebsite */
export async function regenerateDraft(formData: FormData): Promise<void> {
  return approveBuildWebsite(formData);
}
