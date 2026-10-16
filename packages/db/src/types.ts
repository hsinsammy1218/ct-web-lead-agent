import type { Assessment } from "@ct/core";
import type {
  Finding,
  HostClass,
  LeadScore,
  LeadStatus,
  QualityComponents,
} from "@ct/core";

export interface LeadWebsite {
  id: string;
  originalUrl: string;
  finalUrl: string | null;
  registrableDomain: string;
  status: HostClass;
  nameMentionWarning: boolean;
  allowDuplicate: boolean;
}

export interface LeadAudit {
  id: string;
  status: "completed" | "failed" | "blocked" | "skipped" | "queued";
  summary: string;
  components: QualityComponents;
  findings: Finding[];
  auditedAt: string | null;
  screenshotPath: string | null;
}

export interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string;
}

export interface SiteDraft {
  status: "queued" | "ready" | "failed";
  path: string | null;
  previewPath: string | null;
  generatedAt: string | null;
  summary: string | null;
  fixesApplied: string[];
  recommendedService: string | null;
  error: string | null;
}

export interface LeadRecord {
  id: string;
  displayName: string;
  nameNormalized: string;
  industrySlug: string;
  industryName: string;
  municipalityName: string;
  planningRegionId: string;
  planningRegionName: string;
  leadStatus: LeadStatus;
  phone: string | null;
  website: LeadWebsite;
  audit: LeadAudit | null;
  score: LeadScore | null;
  ai: Assessment | null;
  draft: SiteDraft | null;
  notes: LeadNote[];
  statusHistory: Array<{ status: LeadStatus; createdAt: string; createdBy: string }>;
  createdAt: string;
  submittedBy: string;
}

export interface LeadFilters {
  municipality?: string;
  region?: string;
  industry?: string;
  band?: string;
  websiteStatus?: string;
  auditStatus?: string;
  contact?: string;
  submittedFrom?: string;
  submittedTo?: string;
  leadStatus?: string;
  sort?: string;
}

export interface WorkRecord {
  id: string;
  jobType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt: number;
  maxAttempts: number;
  runAfter: string;
  lockedUntil: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface UsageEntry {
  id: string;
  provider: string;
  operation: string;
  quantity: number;
  estimatedCostUsd: number;
  occurredAt: string;
}

export interface DashboardStats {
  submitted: number;
  auditsInProgress: number;
  auditsCompleted: number;
  qualified: number;
  highPriority: number;
  blocked: number;
  spentMonthUsd: number;
  spentDayUsd: number;
}

export interface SubmitResult {
  ok: boolean;
  message: string;
  leadId?: string;
  duplicate?: boolean;
}
