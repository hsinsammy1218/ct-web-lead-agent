import type { Industry, Municipality, PlanningRegion, ReferenceData } from "./types.js";

export function normalizeLookup(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findMunicipality(
  input: string,
  municipalities: Municipality[],
): Municipality | undefined {
  const key = normalizeLookup(input);
  return municipalities.find(
    (municipality) =>
      municipality.nameNormalized === key || normalizeLookup(municipality.name) === key,
  );
}

export function findIndustry(input: string, industries: Industry[]): Industry | undefined {
  const key = normalizeLookup(input);
  return industries.find(
    (industry) =>
      industry.enabled &&
      (industry.slug === key.replace(/ /g, "-") ||
        normalizeLookup(industry.displayName) === key ||
        industry.slug === input.trim().toLowerCase()),
  );
}

export function regionFor(
  municipality: Municipality,
  regions: PlanningRegion[],
): PlanningRegion | undefined {
  return regions.find((region) => region.id === municipality.planningRegionId);
}

export function isKnownMunicipality(input: string, data: ReferenceData): boolean {
  return Boolean(findMunicipality(input, data.municipalities));
}
