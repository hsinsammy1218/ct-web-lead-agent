import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { Industry, Municipality, PlanningRegion, ReferenceData } from "@ct/core";

interface MunicipalityFile {
  regions: Array<{ id: string; name: string; cog_name: string; fips: string }>;
  municipalities: Array<{
    opm_code: string;
    name: string;
    name_normalized: string;
    planning_region_id: string;
    legacy_county: string | null;
  }>;
}

export function loadLocalEnv(start = process.cwd()): void {
  const root = repoRoot(start);
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || process.env[key] != null) continue;
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

export function localDataFile(): string {
  const configured = process.env.DATA_FILE ?? "data/local-store.json";
  return path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
}

export function screenshotDirectory(): string {
  const configured = process.env.SCREENSHOT_DIR ?? "data/screenshots";
  return path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
}

export function repoRoot(start = process.cwd()): string {
  let dir = start;
  for (let hop = 0; hop < 5; hop += 1) {
    if (existsSync(path.join(dir, "config/ct/municipalities.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function loadReferenceData(root = repoRoot()): ReferenceData {
  const file = JSON.parse(
    readFileSync(path.join(root, "config/ct/municipalities.json"), "utf8"),
  ) as MunicipalityFile;
  const industryFile = parse(readFileSync(path.join(root, "config/industries.yaml"), "utf8")) as {
    industries: Array<{ slug: string; display_name: string; enabled: boolean; sort_order: number }>;
  };
  const denylist = JSON.parse(readFileSync(path.join(root, "config/denylist.json"), "utf8")) as string[];
  const regions: PlanningRegion[] = file.regions.map((region) => ({
    id: region.id,
    name: region.name,
    cogName: region.cog_name,
    fips: region.fips,
  }));
  const municipalities: Municipality[] = file.municipalities.map((municipality) => ({
    opmCode: municipality.opm_code,
    name: municipality.name,
    nameNormalized: municipality.name_normalized,
    planningRegionId: municipality.planning_region_id,
  }));
  const industries: Industry[] = industryFile.industries.map((industry) => ({
    slug: industry.slug,
    displayName: industry.display_name,
    enabled: industry.enabled,
    sortOrder: industry.sort_order,
  }));
  return { regions, municipalities, industries, denylist };
}
