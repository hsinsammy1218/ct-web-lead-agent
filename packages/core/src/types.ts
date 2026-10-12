export const HOST_CLASSES = [
  "OPERATOR_SITE",
  "PLATFORM_SITE",
  "SOCIAL_ONLY",
  "DIRECTORY_ONLY",
  "UNREACHABLE",
  "BLOCKED",
] as const;

export type HostClass = (typeof HOST_CLASSES)[number];

export const LEAD_STATUSES = [
  "new",
  "review",
  "qualified",
  "contacted",
  "not_a_fit",
  "closed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SCORE_BANDS = [
  "very_high",
  "high",
  "qualified",
  "review",
  "low",
] as const;

export type ScoreBand = (typeof SCORE_BANDS)[number];

export const RECOMMENDED_SERVICES = [
  "new_site",
  "redesign",
  "local_seo",
  "booking",
  "not_recommended",
  "insufficient_evidence",
] as const;

export type RecommendedService = (typeof RECOMMENDED_SERVICES)[number];

export interface Municipality {
  opmCode: string;
  name: string;
  nameNormalized: string;
  planningRegionId: string;
}

export interface PlanningRegion {
  id: string;
  name: string;
  cogName: string;
  fips: string;
}

export interface Industry {
  slug: string;
  displayName: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ReferenceData {
  municipalities: Municipality[];
  regions: PlanningRegion[];
  industries: Industry[];
  denylist: string[];
}

export interface SubmissionInput {
  businessName: string;
  municipality: string;
  industry: string;
  websiteUrl: string;
  phone?: string;
  note?: string;
}

export interface NormalizedSubmission {
  businessName: string;
  nameNormalized: string;
  municipality: Municipality;
  region: PlanningRegion;
  industry: Industry;
  websiteUrl: string;
  registrableDomain: string;
  phone: string | null;
  note: string | null;
  hostClass: HostClass;
}

export interface Finding {
  category: "performance" | "mobile" | "seo" | "ux" | "technical" | "design";
  code: string;
  severity: "info" | "moderate" | "critical";
  evidence: Record<string, unknown>;
  source: "measured" | "inferred";
}

export interface QualityComponents {
  performance: number | null;
  mobile: number | null;
  seo: number | null;
  ux: number | null;
  technical: number | null;
  design: number | null;
}

export interface ScoreExplanation {
  formula: string;
  quality: number | null;
  need: number | null;
  qualification: number | null;
  contact: number | null;
  confidence: number | null;
  opportunity: number | null;
  band: ScoreBand | null;
  weights: Record<string, number>;
  notes: string[];
}

export interface LeadScore {
  quality: number | null;
  need: number | null;
  qualification: number;
  contact: number;
  confidence: number;
  opportunity: number | null;
  band: ScoreBand | null;
  recommendedService: RecommendedService;
  explanation: ScoreExplanation;
}
