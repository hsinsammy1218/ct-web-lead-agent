import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rmSync } from "node:fs";
import path from "node:path";
import {
  backoffSeconds,
  budgetAllows,
  decideDuplicate,
  parseCsv,
  submissionFromCsvRow,
  toCsv,
  validateSubmission,
  type Assessment,
  type Finding,
  type LeadScore,
  type LeadStatus,
  type NormalizedSubmission,
  type ReferenceData,
} from "@ct/core";
import type { DashboardStats, LeadFilters, LeadRecord, SiteDraft, SubmitResult, WorkRecord } from "./types.js";

type Row = Record<string, unknown>;

export class SupabaseStore {
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    secretKey: string,
    private readonly reference: ReferenceData,
    private readonly caps = { dailyCapUsd: 5, monthlyCapUsd: 50 },
  ) {
    this.client = createClient(url, secretKey, { auth: { persistSession: false } });
  }

  referenceData(): ReferenceData {
    return this.reference;
  }

  async seedReference(): Promise<void> {
    const { error: regionError } = await this.client.from("planning_regions").upsert(
      this.reference.regions.map((region) => ({
        id: region.id,
        name: region.name,
        cog_name: region.cogName,
        fips: region.fips,
      })),
    );
    if (regionError) throw regionError;
    const { error: townError } = await this.client.from("municipalities").upsert(
      this.reference.municipalities.map((municipality) => ({
        opm_code: municipality.opmCode,
        name: municipality.name,
        name_normalized: municipality.nameNormalized,
        planning_region_id: municipality.planningRegionId,
      })),
      { onConflict: "opm_code" },
    );
    if (townError) throw townError;
    const { error: industryError } = await this.client.from("industries").upsert(
      this.reference.industries.map((industry) => ({
        slug: industry.slug,
        display_name: industry.displayName,
        enabled: industry.enabled,
        sort_order: industry.sortOrder,
      })),
      { onConflict: "slug" },
    );
    if (industryError) throw industryError;
  }

  async submit(input: NormalizedSubmission, submittedBy: string, allowDuplicate: boolean): Promise<SubmitResult> {
    const { data: existing } = await this.client
      .from("business_websites")
      .select("business_id, allow_duplicate")
      .eq("registrable_domain", input.registrableDomain)
      .eq("allow_duplicate", false)
      .maybeSingle();
    if (decideDuplicate(Boolean(existing), allowDuplicate) === "skip") {
      return {
        ok: false,
        duplicate: true,
        leadId: existing?.business_id as string | undefined,
        message: `A lead for ${input.registrableDomain} already exists. Confirm to import it again.`,
      };
    }
    const municipalityId = await this.lookup("municipalities", "name", input.municipality.name);
    const industryId = await this.lookup("industries", "slug", input.industry.slug);
    const { data: business, error } = await this.client
      .from("businesses")
      .insert({
        display_name: input.businessName,
        name_normalized: input.nameNormalized,
        industry_id: industryId,
        municipality_id: municipalityId,
        phone: input.phone,
        lead_status: "new",
      })
      .select("id")
      .single();
    if (error || !business) throw error ?? new Error("Could not save the business");
    const { error: websiteError } = await this.client.from("business_websites").insert({
      business_id: business.id,
      original_url: input.websiteUrl,
      registrable_domain: input.registrableDomain,
      status: input.hostClass,
      allow_duplicate: allowDuplicate && Boolean(existing),
    });
    if (websiteError) throw websiteError;
    if (input.phone) {
      await this.client.from("business_contacts").insert({
        business_id: business.id,
        kind: "phone",
        value: input.phone,
        provenance: "operator",
        confidence: 1,
      });
    }
    if (input.note) {
      await this.client.from("lead_notes").insert({ business_id: business.id, body: input.note, created_by: submittedBy });
    }
    await this.client.from("lead_status_history").insert({ business_id: business.id, status: "new", created_by: submittedBy });
    await this.client.from("submissions").insert({
      business_id: business.id,
      raw: input,
      result: "accepted",
      message: "Website queued for audit",
    });
    const websiteId = await this.lookup("business_websites", "business_id", business.id as string);
    await this.enqueueJob("website.audit", `audit:${websiteId}`, { leadId: business.id, websiteId });
    return { ok: true, leadId: business.id as string, message: "Website queued for audit" };
  }

  async importCsv(text: string, submittedBy: string, allowDuplicate: boolean): Promise<{ results: SubmitResult[]; accepted: number; rejected: number }> {
    const rows = parseCsv(text);
    const results: SubmitResult[] = [];
    let accepted = 0;
    let rejected = 0;
    for (const row of rows) {
      const validated = validateSubmission(submissionFromCsvRow(row.values), this.reference);
      if (!validated.ok) {
        rejected += 1;
        results.push({ ok: false, message: `Row ${row.line}: ${validated.message}` });
        continue;
      }
      const result = await this.submit(validated.value, submittedBy, allowDuplicate);
      results.push({ ...result, message: `Row ${row.line}: ${result.message}` });
      if (result.ok) accepted += 1;
      else rejected += 1;
    }
    if (rows.length === 0) {
      rejected += 1;
      results.push({ ok: false, message: "CSV did not contain any data rows" });
    }
    return { results, accepted, rejected };
  }

  async listLeads(filters: LeadFilters = {}): Promise<LeadRecord[]> {
    const { data, error } = await this.client.from("businesses").select(LEAD_SELECT).order("created_at", { ascending: false });
    if (error) throw error;
    const leads = ((data ?? []) as Row[]).map(mapLead).filter((lead) => matches(lead, filters));
    leads.sort((a, b) => compareLeads(a, b, filters.sort || "submitted_desc"));
    return leads;
  }

  async getLead(id: string): Promise<LeadRecord | null> {
    const { data, error } = await this.client.from("businesses").select(LEAD_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapLead(data as Row) : null;
  }

  async addNote(id: string, body: string, createdBy: string): Promise<void> {
    const { error } = await this.client.from("lead_notes").insert({ business_id: id, body: body.trim(), created_by: createdBy });
    if (error) throw error;
  }

  async setStatus(id: string, status: LeadStatus, createdBy: string): Promise<void> {
    const { error } = await this.client.from("businesses").update({ lead_status: status }).eq("id", id);
    if (error) throw error;
    await this.client.from("lead_status_history").insert({ business_id: id, status, created_by: createdBy });
  }

  async claim(): Promise<WorkRecord | null> {
    const { data, error } = await this.client.rpc("claim_work_item");
    if (error) throw error;
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    if (!row?.id) return null;
    return mapWork(row);
  }

  async succeed(id: string): Promise<void> {
    await this.client.from("work_items").update({ status: "succeeded", locked_until: null, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    const { data } = await this.client.from("work_items").select("attempt, max_attempts").eq("id", id).single();
    const attempt = Number(data?.attempt ?? 1);
    const maxAttempts = Number(data?.max_attempts ?? 5);
    if (attempt >= maxAttempts) {
      await this.client.from("work_items").update({ status: "failed", last_error: errorMessage, locked_until: null }).eq("id", id);
      return;
    }
    await this.client
      .from("work_items")
      .update({
        status: "queued",
        last_error: errorMessage,
        locked_until: null,
        run_after: new Date(Date.now() + backoffSeconds(attempt) * 1000).toISOString(),
      })
      .eq("id", id);
  }

  async saveAudit(leadId: string, audit: LeadRecord["audit"]): Promise<void> {
    if (!audit) return;
    const websiteId = await this.lookup("business_websites", "business_id", leadId);
    await this.client.from("website_audits").insert({
      id: audit.id,
      business_website_id: websiteId,
      status: audit.status,
      summary: audit.summary,
      performance_score: audit.components.performance,
      mobile_score: audit.components.mobile,
      seo_score: audit.components.seo,
      ux_score: audit.components.ux,
      technical_score: audit.components.technical,
      design_score: audit.components.design,
      screenshot_path: audit.screenshotPath,
      audited_at: audit.auditedAt,
    });
    if (audit.findings.length > 0) {
      await this.client.from("audit_findings").insert(
        audit.findings.map((finding) => ({
          audit_id: audit.id,
          category: finding.category,
          code: finding.code,
          severity: finding.severity,
          evidence: finding.evidence,
          source: finding.source,
        })),
      );
    }
  }

  async saveScore(leadId: string, score: LeadScore): Promise<void> {
    await this.client.from("lead_scores").upsert({
      business_id: leadId,
      quality: score.quality,
      need: score.need,
      qualification: score.qualification,
      contact: score.contact,
      confidence: score.confidence,
      opportunity: score.opportunity,
      band: score.band,
      recommended_service: score.recommendedService,
      explanation: score.explanation,
      model_version: "rules-v1",
      updated_at: new Date().toISOString(),
    });
    await this.client.from("lead_score_history").insert({ business_id: leadId, explanation: score.explanation });
    if (score.band && ["qualified", "high", "very_high"].includes(score.band)) {
      await this.client.from("businesses").update({ lead_status: "qualified" }).eq("id", leadId).eq("lead_status", "new");
    }
  }

  async saveAi(leadId: string, assessment: Assessment, inputHash: string): Promise<void> {
    await this.client.from("ai_assessments").upsert(
      {
        business_id: leadId,
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        schema_version: "1",
        input_hash: inputHash,
        output: assessment,
        prompt_version: "1",
      },
      { onConflict: "input_hash" },
    );
  }

  async saveSiteDraft(leadId: string, draft: SiteDraft): Promise<void> {
    const { error } = await this.client.from("site_drafts").upsert({
      business_id: leadId,
      status: draft.status,
      path: draft.path,
      preview_path: draft.previewPath,
      generated_at: draft.generatedAt,
      summary: draft.summary,
      fixes_applied: draft.fixesApplied,
      recommended_service: draft.recommendedService,
      error: draft.error,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async updateWebsite(leadId: string, patch: Partial<LeadRecord["website"]>): Promise<void> {
    const update: Row = {};
    if (patch.finalUrl !== undefined) update.final_url = patch.finalUrl;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.nameMentionWarning !== undefined) update.name_mention_warning = patch.nameMentionWarning;
    if (patch.registrableDomain !== undefined) update.registrable_domain = patch.registrableDomain;
    update.fetched_at = new Date().toISOString();
    await this.client.from("business_websites").update(update).eq("business_id", leadId);
  }

  async enqueueJob(jobType: string, idempotencyKey: string, payload: Record<string, unknown>): Promise<void> {
    await this.client.from("work_items").upsert(
      { job_type: jobType, idempotency_key: idempotencyKey, payload, status: "queued" },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  }

  async recordUsage(provider: string, operation: string, quantity: number, estimatedCostUsd: number): Promise<void> {
    await this.client.from("api_usage_ledger").insert({
      provider,
      operation,
      quantity,
      estimated_cost_usd: estimatedCostUsd,
    });
  }

  async budgetDecision(nextCostUsd: number): Promise<{ ok: true } | { ok: false; reason: string }> {
    const stats = await this.stats();
    return budgetAllows(
      {
        spentDayUsd: stats.spentDayUsd,
        spentMonthUsd: stats.spentMonthUsd,
        dailyCapUsd: this.caps.dailyCapUsd,
        monthlyCapUsd: this.caps.monthlyCapUsd,
      },
      nextCostUsd,
    );
  }

  async stats(): Promise<DashboardStats> {
    const leads = await this.listLeads();
    const work = await this.listWork();
    const sinceDay = new Date();
    sinceDay.setUTCHours(0, 0, 0, 0);
    const sinceMonth = new Date(Date.UTC(sinceDay.getUTCFullYear(), sinceDay.getUTCMonth(), 1));
    const { data } = await this.client.from("api_usage_ledger").select("estimated_cost_usd, occurred_at");
    const usage = (data ?? []) as Array<{ estimated_cost_usd: number; occurred_at: string }>;
    const spent = (from: Date) =>
      usage.filter((entry) => Date.parse(entry.occurred_at) >= from.getTime()).reduce((sum, entry) => sum + Number(entry.estimated_cost_usd), 0);
    return {
      submitted: leads.length,
      auditsInProgress: work.filter((item) => item.jobType === "website.audit" && (item.status === "queued" || item.status === "running")).length,
      auditsCompleted: leads.filter((lead) => lead.audit?.status === "completed").length,
      qualified: leads.filter((lead) => ["qualified", "high", "very_high"].includes(lead.score?.band ?? "")).length,
      highPriority: leads.filter((lead) => ["high", "very_high"].includes(lead.score?.band ?? "")).length,
      blocked: leads.filter((lead) => lead.audit?.status === "blocked").length,
      spentMonthUsd: Math.round(spent(sinceMonth) * 1000) / 1000,
      spentDayUsd: Math.round(spent(sinceDay) * 1000) / 1000,
    };
  }

  async listWork(): Promise<WorkRecord[]> {
    const { data, error } = await this.client.from("work_items").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(mapWork);
  }

  async exportCsv(filters: LeadFilters = {}): Promise<string> {
    const rows = (await this.listLeads(filters)).map((lead) => [
      lead.displayName,
      lead.municipalityName,
      lead.planningRegionName,
      lead.industryName,
      lead.website.originalUrl,
      lead.website.status,
      lead.score?.quality ?? null,
      lead.score?.opportunity ?? null,
      lead.score?.band ?? null,
      lead.score?.contact ? "yes" : "no",
      lead.score?.recommendedService ?? "",
      lead.audit?.auditedAt ?? "",
      lead.leadStatus,
      lead.phone ?? "",
    ]);
    return toCsv(
      ["business_name", "municipality", "planning_region", "industry", "website_url", "website_status", "website_quality", "lead_score", "band", "contact_availability", "recommended_service", "last_audited", "lead_status", "phone"],
      rows,
    );
  }

  async enqueueDueReaudits(days: number): Promise<number> {
    const leads = await this.listLeads();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const lead of leads) {
      if (!lead.audit?.auditedAt || Date.parse(lead.audit.auditedAt) > cutoff) continue;
      await this.enqueueJob("website.audit", `reaudit:${lead.website.id}:${lead.audit.auditedAt}`, {
        leadId: lead.id,
        websiteId: lead.website.id,
      });
      count += 1;
    }
    return count;
  }

  async retentionCleanup(retentionDays: number, screenshotDir: string): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await this.client.from("website_audits").select("id, screenshot_path").lt("audited_at", cutoff).not("screenshot_path", "is", null);
    let removed = 0;
    for (const row of data ?? []) {
      if (row.screenshot_path) rmSync(path.join(screenshotDir, path.basename(row.screenshot_path)), { force: true });
      await this.client.from("website_audits").update({ screenshot_path: null }).eq("id", row.id);
      removed += 1;
    }
    return removed;
  }

  private async lookup(table: string, column: string, value: string): Promise<string> {
    const { data, error } = await this.client.from(table).select("id").eq(column, value).single();
    if (error || !data) throw error ?? new Error(`Missing ${table} row for ${value}`);
    return data.id as string;
  }
}

const LEAD_SELECT = `
  id, display_name, name_normalized, lead_status, phone, created_at,
  industries(slug, display_name),
  municipalities(name, planning_region_id, planning_regions(name)),
  business_websites(id, original_url, final_url, registrable_domain, status, name_mention_warning, allow_duplicate, website_audits(id, status, summary, performance_score, mobile_score, seo_score, ux_score, technical_score, design_score, screenshot_path, audited_at, audit_findings(category, code, severity, evidence, source))),
  lead_notes(id, body, created_at, created_by),
  lead_status_history(status, created_at, created_by),
  lead_scores(quality, need, qualification, contact, confidence, opportunity, band, recommended_service, explanation),
  ai_assessments(output),
  site_drafts(status, path, preview_path, generated_at, summary, fixes_applied, recommended_service, error)
`;

function mapLead(row: Row): LeadRecord {
  const industry = first(row.industries) as Row;
  const municipality = first(row.municipalities) as Row;
  const region = first(municipality?.planning_regions) as Row;
  const website = first(row.business_websites) as Row;
  const audits = (website?.website_audits as Row[] | undefined) ?? [];
  const latest = audits.slice().sort((a, b) => String(b.audited_at ?? "").localeCompare(String(a.audited_at ?? "")))[0];
  const score = first(row.lead_scores) as Row | null;
  const ai = first(row.ai_assessments) as Row | null;
  const draft = first(row.site_drafts) as Row | null;
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    nameNormalized: String(row.name_normalized),
    industrySlug: String(industry?.slug ?? ""),
    industryName: String(industry?.display_name ?? ""),
    municipalityName: String(municipality?.name ?? ""),
    planningRegionId: String(municipality?.planning_region_id ?? ""),
    planningRegionName: String(region?.name ?? ""),
    leadStatus: row.lead_status as LeadStatus,
    phone: (row.phone as string | null) ?? null,
    website: {
      id: String(website?.id ?? ""),
      originalUrl: String(website?.original_url ?? ""),
      finalUrl: (website?.final_url as string | null) ?? null,
      registrableDomain: String(website?.registrable_domain ?? ""),
      status: website?.status as LeadRecord["website"]["status"],
      nameMentionWarning: Boolean(website?.name_mention_warning),
      allowDuplicate: Boolean(website?.allow_duplicate),
    },
    audit: latest
      ? {
          id: String(latest.id),
          status: latest.status as NonNullable<LeadRecord["audit"]>["status"],
          summary: String(latest.summary ?? ""),
          components: {
            performance: num(latest.performance_score),
            mobile: num(latest.mobile_score),
            seo: num(latest.seo_score),
            ux: num(latest.ux_score),
            technical: num(latest.technical_score),
            design: num(latest.design_score),
          },
          findings: ((latest.audit_findings as Row[]) ?? []).map((finding) => ({
            category: finding.category as Finding["category"],
            code: String(finding.code),
            severity: finding.severity as Finding["severity"],
            evidence: (finding.evidence as Record<string, unknown>) ?? {},
            source: finding.source as Finding["source"],
          })),
          auditedAt: (latest.audited_at as string | null) ?? null,
          screenshotPath: (latest.screenshot_path as string | null) ?? null,
        }
      : null,
    score: score
      ? {
          quality: num(score.quality),
          need: num(score.need),
          qualification: Number(score.qualification),
          contact: Number(score.contact),
          confidence: Number(score.confidence),
          opportunity: num(score.opportunity),
          band: (score.band as LeadScore["band"]) ?? null,
          recommendedService: score.recommended_service as LeadScore["recommendedService"],
          explanation: score.explanation as LeadScore["explanation"],
        }
      : null,
    ai: (ai?.output as Assessment | undefined) ?? null,
    draft: draft
      ? {
          status: draft.status as SiteDraft["status"],
          path: (draft.path as string | null) ?? null,
          previewPath: (draft.preview_path as string | null) ?? null,
          generatedAt: (draft.generated_at as string | null) ?? null,
          summary: (draft.summary as string | null) ?? null,
          fixesApplied: Array.isArray(draft.fixes_applied) ? (draft.fixes_applied as string[]) : [],
          recommendedService: (draft.recommended_service as string | null) ?? null,
          error: (draft.error as string | null) ?? null,
        }
      : null,
    notes: ((row.lead_notes as Row[]) ?? []).map((note) => ({
      id: String(note.id),
      body: String(note.body),
      createdAt: String(note.created_at),
      createdBy: String(note.created_by ?? ""),
    })),
    statusHistory: ((row.lead_status_history as Row[]) ?? []).map((entry) => ({
      status: entry.status as LeadStatus,
      createdAt: String(entry.created_at),
      createdBy: String(entry.created_by ?? ""),
    })),
    createdAt: String(row.created_at),
    submittedBy: "",
  };
}

function mapWork(row: Row): WorkRecord {
  return {
    id: String(row.id),
    jobType: String(row.job_type),
    idempotencyKey: String(row.idempotency_key),
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as WorkRecord["status"],
    attempt: Number(row.attempt ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    runAfter: String(row.run_after),
    lockedUntil: (row.locked_until as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function first(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row) ?? null;
  return (value as Row) ?? null;
}

function num(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function matches(lead: LeadRecord, filters: LeadFilters): boolean {
  if (filters.municipality && lead.municipalityName !== filters.municipality) return false;
  if (filters.region && lead.planningRegionId !== filters.region) return false;
  if (filters.industry && lead.industrySlug !== filters.industry) return false;
  if (filters.band && lead.score?.band !== filters.band) return false;
  if (filters.websiteStatus && lead.website.status !== filters.websiteStatus) return false;
  if (filters.auditStatus && lead.audit?.status !== filters.auditStatus) return false;
  if (filters.leadStatus && lead.leadStatus !== filters.leadStatus) return false;
  if (filters.contact === "yes" && !(lead.phone || (lead.score?.contact ?? 0) > 0)) return false;
  if (filters.contact === "no" && (lead.phone || (lead.score?.contact ?? 0) > 0)) return false;
  if (filters.submittedFrom && lead.createdAt.slice(0, 10) < filters.submittedFrom) return false;
  if (filters.submittedTo && lead.createdAt.slice(0, 10) > filters.submittedTo) return false;
  return true;
}

function compareLeads(a: LeadRecord, b: LeadRecord, sort: string): number {
  if (sort === "opportunity_desc") return (b.score?.opportunity ?? -1) - (a.score?.opportunity ?? -1);
  if (sort === "quality_asc") return (a.score?.quality ?? 101) - (b.score?.quality ?? 101);
  if (sort === "audited_desc") return (b.audit?.auditedAt ?? "").localeCompare(a.audit?.auditedAt ?? "");
  if (sort === "industry") return a.industryName.localeCompare(b.industryName);
  if (sort === "municipality") return a.municipalityName.localeCompare(b.municipalityName);
  return b.createdAt.localeCompare(a.createdAt);
}
