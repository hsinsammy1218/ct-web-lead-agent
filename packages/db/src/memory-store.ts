import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  type HostClass,
  type LeadScore,
  type LeadStatus,
  type NormalizedSubmission,
  type QualityComponents,
  type ReferenceData,
} from "@ct/core";
import type {
  DashboardStats,
  LeadFilters,
  LeadRecord,
  SiteDraft,
  SubmitResult,
  UsageEntry,
  WorkRecord,
} from "./types.js";

interface DatabaseFile {
  leads: LeadRecord[];
  work: WorkRecord[];
  usage: UsageEntry[];
}

const EMPTY: DatabaseFile = { leads: [], work: [], usage: [] };

export class MemoryStore {
  constructor(
    private readonly filePath: string,
    private readonly reference: ReferenceData,
    private readonly caps = { dailyCapUsd: 5, monthlyCapUsd: 50 },
  ) {}

  referenceData(): ReferenceData {
    return this.reference;
  }

  async submit(input: NormalizedSubmission, submittedBy: string, allowDuplicate: boolean): Promise<SubmitResult> {
    const db = this.read();
    const existing = db.leads.find(
      (lead) => lead.website.registrableDomain === input.registrableDomain && !lead.website.allowDuplicate,
    );
    if (decideDuplicate(Boolean(existing), allowDuplicate) === "skip") {
      return {
        ok: false,
        duplicate: true,
        leadId: existing?.id,
        message: `A lead for ${input.registrableDomain} already exists. Confirm to import it again.`,
      };
    }
    const now = new Date().toISOString();
    const lead = this.makeLead(input, submittedBy, allowDuplicate && Boolean(existing), now);
    db.leads.push(lead);
    this.enqueue(db, "website.audit", `audit:${lead.website.id}`, { leadId: lead.id, websiteId: lead.website.id });
    this.write(db);
    return { ok: true, leadId: lead.id, message: "Website queued for audit" };
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
      results.push({ ...result, message: result.ok ? `Row ${row.line}: ${result.message}` : `Row ${row.line}: ${result.message}` });
      if (result.ok) accepted += 1;
      else rejected += 1;
    }
    if (rows.length === 0) {
      results.push({ ok: false, message: "CSV did not contain any data rows" });
      rejected += 1;
    }
    return { results, accepted, rejected };
  }

  async listLeads(filters: LeadFilters = {}): Promise<LeadRecord[]> {
    const leads = this.read().leads.filter((lead) => matches(lead, filters));
    const sort = filters.sort || "submitted_desc";
    leads.sort((a, b) => compareLeads(a, b, sort));
    return leads;
  }

  async getLead(id: string): Promise<LeadRecord | null> {
    return this.read().leads.find((lead) => lead.id === id) ?? null;
  }

  async addNote(id: string, body: string, createdBy: string): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, id);
    lead.notes.push({ id: randomUUID(), body: body.trim(), createdAt: new Date().toISOString(), createdBy });
    this.write(db);
  }

  async setStatus(id: string, status: LeadStatus, createdBy: string): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, id);
    lead.leadStatus = status;
    lead.statusHistory.push({ status, createdAt: new Date().toISOString(), createdBy });
    this.write(db);
  }

  async claim(): Promise<WorkRecord | null> {
    const db = this.read();
    const now = Date.now();
    const item = db.work
      .filter((work) => work.status === "queued" || (work.status === "running" && work.lockedUntil && Date.parse(work.lockedUntil) < now))
      .filter((work) => Date.parse(work.runAfter) <= now && work.attempt < work.maxAttempts)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!item) return null;
    item.status = "running";
    item.attempt += 1;
    item.lockedUntil = new Date(now + 10 * 60 * 1000).toISOString();
    this.write(db);
    return item;
  }

  async succeed(id: string): Promise<void> {
    const db = this.read();
    const item = db.work.find((work) => work.id === id);
    if (!item) return;
    item.status = "succeeded";
    item.lockedUntil = null;
    this.write(db);
  }

  async fail(id: string, error: string): Promise<void> {
    const db = this.read();
    const item = db.work.find((work) => work.id === id);
    if (!item) return;
    item.lastError = error;
    if (item.attempt >= item.maxAttempts) {
      item.status = "failed";
      item.lockedUntil = null;
    } else {
      item.status = "queued";
      item.lockedUntil = null;
      item.runAfter = new Date(Date.now() + backoffSeconds(item.attempt) * 1000).toISOString();
    }
    this.write(db);
  }

  async saveAudit(leadId: string, audit: LeadRecord["audit"]): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, leadId);
    lead.audit = audit;
    this.write(db);
  }

  async saveScore(leadId: string, score: LeadScore): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, leadId);
    lead.score = score;
    if (lead.leadStatus === "new" && score.band && ["qualified", "high", "very_high"].includes(score.band)) {
      lead.leadStatus = "qualified";
      lead.statusHistory.push({ status: "qualified", createdAt: new Date().toISOString(), createdBy: "scoring" });
    }
    this.write(db);
  }

  async saveAi(leadId: string, assessment: Assessment, _inputHash?: string): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, leadId);
    lead.ai = assessment;
    if (lead.score) lead.score.recommendedService = assessment.recommended_service;
    this.write(db);
  }

  async saveSiteDraft(leadId: string, draft: SiteDraft): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, leadId);
    lead.draft = draft;
    this.write(db);
  }

  async updateWebsite(leadId: string, patch: Partial<LeadRecord["website"]> & { status?: HostClass }): Promise<void> {
    const db = this.read();
    const lead = requiredLead(db, leadId);
    lead.website = { ...lead.website, ...patch };
    this.write(db);
  }

  async enqueueJob(jobType: string, idempotencyKey: string, payload: Record<string, unknown>): Promise<void> {
    const db = this.read();
    this.enqueue(db, jobType, idempotencyKey, payload);
    this.write(db);
  }

  async recordUsage(provider: string, operation: string, quantity: number, estimatedCostUsd: number): Promise<void> {
    const db = this.read();
    db.usage.push({
      id: randomUUID(),
      provider,
      operation,
      quantity,
      estimatedCostUsd,
      occurredAt: new Date().toISOString(),
    });
    this.write(db);
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
    const db = this.read();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const spent = (from: Date) =>
      db.usage
        .filter((entry) => Date.parse(entry.occurredAt) >= from.getTime())
        .reduce((sum, entry) => sum + entry.estimatedCostUsd, 0);
    return {
      submitted: db.leads.length,
      auditsInProgress: db.work.filter((work) => work.jobType === "website.audit" && (work.status === "queued" || work.status === "running")).length,
      auditsCompleted: db.leads.filter((lead) => lead.audit?.status === "completed").length,
      qualified: db.leads.filter((lead) => ["qualified", "high", "very_high"].includes(lead.score?.band ?? "")).length,
      highPriority: db.leads.filter((lead) => ["high", "very_high"].includes(lead.score?.band ?? "")).length,
      blocked: db.leads.filter((lead) => lead.audit?.status === "blocked" || lead.website.status === "BLOCKED").length,
      spentMonthUsd: roundMoney(spent(startOfMonth)),
      spentDayUsd: roundMoney(spent(startOfDay)),
    };
  }

  async listWork(): Promise<WorkRecord[]> {
    return this.read().work.slice().reverse();
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
      [
        "business_name",
        "municipality",
        "planning_region",
        "industry",
        "website_url",
        "website_status",
        "website_quality",
        "lead_score",
        "band",
        "contact_availability",
        "recommended_service",
        "last_audited",
        "lead_status",
        "phone",
      ],
      rows,
    );
  }

  async enqueueDueReaudits(days: number): Promise<number> {
    const db = this.read();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const lead of db.leads) {
      if (!lead.audit?.auditedAt) continue;
      if (Date.parse(lead.audit.auditedAt) > cutoff) continue;
      const key = `reaudit:${lead.website.id}:${lead.audit.auditedAt}`;
      if (db.work.some((work) => work.idempotencyKey === key)) continue;
      this.enqueue(db, "website.audit", key, { leadId: lead.id, websiteId: lead.website.id });
      count += 1;
    }
    this.write(db);
    return count;
  }

  async retentionCleanup(retentionDays: number, screenshotDir: string): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const db = this.read();
    let removed = 0;
    for (const lead of db.leads) {
      if (!lead.audit?.screenshotPath || !lead.audit.auditedAt) continue;
      if (Date.parse(lead.audit.auditedAt) > cutoff) continue;
      const file = path.join(screenshotDir, path.basename(lead.audit.screenshotPath));
      rmSync(file, { force: true });
      lead.audit.screenshotPath = null;
      removed += 1;
    }
    this.write(db);
    return removed;
  }

  private enqueue(db: DatabaseFile, jobType: string, idempotencyKey: string, payload: Record<string, unknown>): void {
    if (db.work.some((work) => work.idempotencyKey === idempotencyKey && work.status !== "failed")) return;
    const now = new Date().toISOString();
    db.work.push({
      id: randomUUID(),
      jobType,
      idempotencyKey,
      payload,
      status: "queued",
      attempt: 0,
      maxAttempts: 5,
      runAfter: now,
      lockedUntil: null,
      lastError: null,
      createdAt: now,
    });
  }

  private makeLead(input: NormalizedSubmission, submittedBy: string, allowDuplicate: boolean, now: string): LeadRecord {
    return {
      id: randomUUID(),
      displayName: input.businessName,
      nameNormalized: input.nameNormalized,
      industrySlug: input.industry.slug,
      industryName: input.industry.displayName,
      municipalityName: input.municipality.name,
      planningRegionId: input.region.id,
      planningRegionName: input.region.name,
      leadStatus: "new",
      phone: input.phone,
      website: {
        id: randomUUID(),
        originalUrl: input.websiteUrl,
        finalUrl: null,
        registrableDomain: input.registrableDomain,
        status: input.hostClass,
        nameMentionWarning: false,
        allowDuplicate,
      },
      audit: {
        id: randomUUID(),
        status: "queued",
        summary: "Waiting for the audit worker.",
        components: { performance: null, mobile: null, seo: null, ux: null, technical: null, design: null },
        findings: [],
        auditedAt: null,
        screenshotPath: null,
      },
      score: null,
      ai: null,
      draft: null,
      notes: input.note ? [{ id: randomUUID(), body: input.note, createdAt: now, createdBy: submittedBy }] : [],
      statusHistory: [{ status: "new", createdAt: now, createdBy: submittedBy }],
      createdAt: now,
      submittedBy,
    };
  }

  private read(): DatabaseFile {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as DatabaseFile;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  private write(db: DatabaseFile): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(db, null, 2));
  }
}

function requiredLead(db: DatabaseFile, id: string): LeadRecord {
  const lead = db.leads.find((item) => item.id === id);
  if (!lead) throw new Error("Lead not found");
  return lead;
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
  const opportunity = (b.score?.opportunity ?? -1) - (a.score?.opportunity ?? -1);
  if (sort === "opportunity_desc") return opportunity;
  if (sort === "quality_asc") return (a.score?.quality ?? 101) - (b.score?.quality ?? 101);
  if (sort === "audited_desc") return (b.audit?.auditedAt ?? "").localeCompare(a.audit?.auditedAt ?? "");
  if (sort === "industry") return a.industryName.localeCompare(b.industryName);
  if (sort === "municipality") return a.municipalityName.localeCompare(b.municipalityName);
  return b.createdAt.localeCompare(a.createdAt);
}

function roundMoney(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type { Finding, QualityComponents };
