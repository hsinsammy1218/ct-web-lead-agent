"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSubmission, type LeadStatus } from "@ct/core";
import { COOKIE, currentOperator, operatorEmails, signOperator } from "../lib/auth";
import { getStore } from "../lib/store";

async function operatorOrRedirect(): Promise<string> {
  const email = await currentOperator();
  if (!email) redirect("/login");
  return email;
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!operatorEmails().includes(email)) redirect("/login?error=not-allowed");
  if (process.env.DATA_DRIVER === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("../lib/supabase");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback` } });
    if (error) redirect("/login?error=auth");
    redirect("/login?sent=1");
  }
  if (process.env.ALLOW_DEV_AUTH !== "true") redirect("/login?error=auth-disabled");
  const jar = await cookies();
  jar.set(COOKIE, await signOperator(email), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signOut(): Promise<void> {
  if (process.env.DATA_DRIVER === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import("../lib/supabase");
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/login");
}

export async function submitWebsite(formData: FormData): Promise<void> {
  const email = await operatorOrRedirect();
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
  const email = await operatorOrRedirect();
  const file = formData.get("file");
  const pasted = String(formData.get("csv") ?? "");
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  const result = await getStore().importCsv(text, email, formData.get("allow_duplicate") === "on");
  const summary = result.results.map((row) => row.message).join(" | ").slice(0, 500);
  redirect(`/leads/import?accepted=${result.accepted}&rejected=${result.rejected}&summary=${encodeURIComponent(summary)}`);
}

export async function addNote(formData: FormData): Promise<void> {
  const email = await operatorOrRedirect();
  const id = String(formData.get("lead_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body) await getStore().addNote(id, body, email);
  redirect(`/leads/${id}`);
}

export async function setLeadStatus(formData: FormData): Promise<void> {
  const email = await operatorOrRedirect();
  const id = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("status") ?? "new") as LeadStatus;
  await getStore().setStatus(id, status, email);
  redirect(`/leads/${id}`);
}

export async function reaudit(formData: FormData): Promise<void> {
  await operatorOrRedirect();
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
  await operatorOrRedirect();
  const id = String(formData.get("lead_id") ?? "");
  await getStore().enqueueJob("lead.score", `rescore:${id}:${Date.now()}`, { leadId: id });
  redirect(`/leads/${id}?queued=1`);
}

export async function regenerateDraft(formData: FormData): Promise<void> {
  await operatorOrRedirect();
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
