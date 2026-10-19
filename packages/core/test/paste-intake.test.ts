import { describe, expect, it } from "vitest";
import {
  extractCandidateUrls,
  findMunicipalityInText,
  guessIndustrySlug,
  heuristicPasteDraft,
  normalizePasteDraft,
} from "../src/paste-intake.js";
import type { ReferenceData } from "../src/types.js";

const data: ReferenceData = {
  regions: [{ id: "capitol", name: "Capitol", cogName: "Capitol Planning Region", fips: "9110" }],
  municipalities: [
    {
      opmCode: "911001080",
      name: "Hartford",
      nameNormalized: "hartford",
      planningRegionId: "capitol",
    },
    {
      opmCode: "911002500",
      name: "New Haven",
      nameNormalized: "new haven",
      planningRegionId: "capitol",
    },
  ],
  industries: [
    { slug: "restaurants", displayName: "Restaurants", enabled: true, sortOrder: 1 },
    { slug: "ice-cream-dessert", displayName: "Ice cream & dessert shops", enabled: true, sortOrder: 2 },
    { slug: "boxing-gyms", displayName: "Boxing gyms", enabled: true, sortOrder: 3 },
    { slug: "martial-arts", displayName: "Martial arts schools", enabled: true, sortOrder: 4 },
    { slug: "fitness-gyms", displayName: "Fitness gyms", enabled: true, sortOrder: 5 },
    { slug: "professional-services", displayName: "Other local business", enabled: true, sortOrder: 90 },
  ],
  denylist: [],
};

describe("paste intake", () => {
  it("extracts and normalizes website URLs from free text", () => {
    expect(extractCandidateUrls("Check www.harborbox.example/home today")).toEqual([
      "https://www.harborbox.example/home",
    ]);
    expect(extractCandidateUrls("https://safe.example")[0]).toBe("https://safe.example/");
  });

  it("finds Connecticut towns and industry keywords across food and fitness", () => {
    expect(findMunicipalityInText("Boxing gym in New Haven CT", data)).toBe("New Haven");
    expect(guessIndustrySlug("family martial arts academy", data.industries)).toBe("martial-arts");
    expect(guessIndustrySlug("Scoops ice cream shop on Main St", data.industries)).toBe("ice-cream-dessert");
    expect(guessIndustrySlug("Harbor pizza restaurant", data.industries)).toBe("restaurants");
  });

  it("builds a heuristic draft from a business blurb", () => {
    const draft = heuristicPasteDraft(
      "Harbor Boxing\nHartford boxing gym\nhttps://harborboxing.example\n(860) 555-0199",
      data,
    );
    expect(draft.businessName).toBe("Harbor Boxing");
    expect(draft.municipality).toBe("Hartford");
    expect(draft.industry).toBe("boxing-gyms");
    expect(draft.websiteUrl).toBe("https://harborboxing.example/");
    expect(draft.phone).toBe("+18605550199");
  });

  it("snaps free-text industry labels onto configured slugs", () => {
    const normalized = normalizePasteDraft(
      {
        businessName: "Harbor Boxing",
        municipality: "hartford",
        industry: "Boxing gyms",
        websiteUrl: "harborboxing.example",
        phone: "8605550199",
        note: "",
      },
      data,
    );
    expect(normalized.municipality).toBe("Hartford");
    expect(normalized.industry).toBe("boxing-gyms");
    expect(normalized.websiteUrl).toBe("https://harborboxing.example/");
    expect(normalized.phone).toBe("+18605550199");
  });
});
