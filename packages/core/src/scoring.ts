import type {
  HostClass,
  LeadScore,
  QualityComponents,
  RecommendedService,
  ScoreBand,
} from "./types.js";
import { normalizeLookup } from "./reference.js";

export const QUALITY_WEIGHTS = {
  performance: 20,
  mobile: 20,
  seo: 15,
  ux: 20,
  technical: 15,
  design: 0,
} as const;

export function websiteQuality(components: QualityComponents): number | null {
  let weighted = 0;
  let weight = 0;
  for (const key of Object.keys(QUALITY_WEIGHTS) as Array<keyof typeof QUALITY_WEIGHTS>) {
    const componentWeight = QUALITY_WEIGHTS[key];
    const value = components[key];
    if (componentWeight === 0 || value == null) continue;
    weighted += value * componentWeight;
    weight += componentWeight;
  }
  if (weight === 0) return null;
  return clamp(Math.round(weighted / weight));
}

export function websiteNeed(hostClass: HostClass, quality: number | null): number | null {
  if (hostClass === "UNREACHABLE" || hostClass === "BLOCKED") return null;
  if (hostClass === "SOCIAL_ONLY") return 75;
  if (hostClass === "DIRECTORY_ONLY") return 70;
  if (quality == null) return null;
  let need = needFromQuality(quality);
  if (hostClass === "PLATFORM_SITE") need = Math.min(need, 60);
  return clamp(need);
}

function needFromQuality(quality: number): number {
  if (quality < 40) return Math.round(85 - (quality / 40) * 15);
  if (quality < 70) return Math.round(65 - ((quality - 40) / 29) * 30);
  return Math.round(30 - ((quality - 70) / 30) * 25);
}

export function businessQualification(input: {
  hasMunicipality: boolean;
  hasIndustry: boolean;
  hasName: boolean;
  normalizedName: string;
  denylist: string[];
}): number {
  let score = 0;
  if (input.hasMunicipality) score += 40;
  if (input.hasIndustry) score += 30;
  if (input.hasName) score += 30;
  const name = normalizeLookup(input.normalizedName);
  const blocked = input.denylist.some((entry) => name.includes(normalizeLookup(entry)));
  if (blocked) return Math.min(score, 20);
  return clamp(score);
}

export function contactAvailability(input: {
  operatorPhone: boolean;
  pagePhone: boolean;
  pageEmail: boolean;
  contactForm: boolean;
}): number {
  let score = 0;
  if (input.operatorPhone) score += 40;
  if (input.pagePhone) score += 30;
  if (input.pageEmail) score += 20;
  if (input.contactForm) score += 20;
  return clamp(score);
}

export function evidenceConfidence(input: {
  hostClass: HostClass;
  nameMentioned: boolean | null;
  componentsMeasured: number;
  componentsExpected: number;
}): number {
  if (input.hostClass === "BLOCKED") return 35;
  if (input.hostClass === "UNREACHABLE") return 30;
  let base = 85;
  if (input.hostClass === "SOCIAL_ONLY" || input.hostClass === "DIRECTORY_ONLY") base = 50;
  if (input.nameMentioned === false) base = Math.min(base, 60);
  if (input.componentsExpected === 0) return clamp(base);
  const completeness = Math.round((input.componentsMeasured / input.componentsExpected) * 100);
  return clamp(Math.round(0.5 * base + 0.5 * completeness));
}

export function scoreLead(input: {
  hostClass: HostClass;
  components: QualityComponents;
  hasMunicipality: boolean;
  hasIndustry: boolean;
  hasName: boolean;
  normalizedName: string;
  denylist: string[];
  operatorPhone: boolean;
  pagePhone: boolean;
  pageEmail: boolean;
  contactForm: boolean;
  nameMentioned: boolean | null;
}): LeadScore {
  const quality =
    input.hostClass === "OPERATOR_SITE" || input.hostClass === "PLATFORM_SITE"
      ? websiteQuality(input.components)
      : null;
  const need = websiteNeed(input.hostClass, quality);
  const qualification = businessQualification(input);
  const contact = contactAvailability(input);
  const measured = Object.values(input.components).filter((value) => value != null).length;
  const confidence = evidenceConfidence({
    hostClass: input.hostClass,
    nameMentioned: input.nameMentioned,
    componentsMeasured: measured,
    componentsExpected:
      input.hostClass === "OPERATOR_SITE" || input.hostClass === "PLATFORM_SITE" ? 5 : 0,
  });
  const opportunity =
    need == null
      ? null
      : clamp(
          Math.round(
            (0.45 * need + 0.4 * qualification + 0.15 * contact) *
              (0.6 + 0.4 * (confidence / 100)),
          ),
        );
  const recommendedService = recommendService(input.hostClass, quality);
  return {
    quality,
    need,
    qualification,
    contact,
    confidence,
    opportunity,
    band: opportunity == null ? null : scoreBand(opportunity),
    recommendedService,
    explanation: {
      formula:
        "(0.45 * need + 0.40 * qualification + 0.15 * contact) * (0.60 + 0.40 * confidence/100)",
      quality,
      need,
      qualification,
      contact,
      confidence,
      opportunity,
      band: opportunity == null ? null : scoreBand(opportunity),
      weights: { need: 0.45, qualification: 0.4, contact: 0.15 },
      notes: [
        "Website quality is not inverted into the opportunity score.",
        "Confidence is a multiplier, so thin evidence cannot reach the top band on its own.",
        input.hostClass === "BLOCKED" || input.hostClass === "UNREACHABLE"
          ? "A failed fetch leaves quality and opportunity empty."
          : "Scores use measured audit components only.",
      ],
    },
  };
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "very_high";
  if (score >= 80) return "high";
  if (score >= 70) return "qualified";
  if (score >= 50) return "review";
  return "low";
}

export function recommendService(
  hostClass: HostClass,
  quality: number | null,
): RecommendedService {
  if (hostClass === "BLOCKED" || hostClass === "UNREACHABLE") return "insufficient_evidence";
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY") return "new_site";
  if (hostClass === "PLATFORM_SITE") return "booking";
  if (quality == null) return "insufficient_evidence";
  if (quality < 50) return "redesign";
  if (quality < 70) return "local_seo";
  return "not_recommended";
}

export function shouldRequestAi(hostClass: HostClass, quality: number | null, threshold: number): boolean {
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY") return true;
  if (hostClass === "BLOCKED" || hostClass === "UNREACHABLE") return false;
  return quality != null && quality < threshold;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
