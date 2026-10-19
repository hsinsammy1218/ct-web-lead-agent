import { describe, expect, it } from "vitest";
import { buildDraftSite, fixesFromFindings } from "../src/site-draft.js";

describe("site draft generation", () => {
  it("builds a homepage that applies measured findings", () => {
    const result = buildDraftSite({
      leadId: "00000000-0000-0000-0000-000000000001",
      businessName: "In your corner fitness",
      municipality: "Wolcott",
      planningRegion: "Naugatuck Valley",
      industry: "Local professional services",
      phone: null,
      currentUrl: "https://www.inyourcornerfitness.com/",
      hostClass: "OPERATOR_SITE",
      findings: [
        { category: "seo", code: "missing_meta_description", severity: "moderate", evidence: {}, source: "measured" },
        { category: "seo", code: "heading_structure", severity: "moderate", evidence: {}, source: "measured" },
        { category: "ux", code: "no_click_to_call", severity: "moderate", evidence: {}, source: "measured" },
        { category: "ux", code: "no_contact_form", severity: "moderate", evidence: {}, source: "measured" },
        { category: "technical", code: "images_missing_alt", severity: "moderate", evidence: {}, source: "measured" },
      ],
      score: {
        quality: 59,
        need: 45,
        qualification: 100,
        contact: 20,
        confidence: 83,
        opportunity: 59,
        band: "review",
        recommendedService: "local_seo",
        explanation: {
          formula: "test",
          quality: 59,
          need: 45,
          qualification: 100,
          contact: 20,
          confidence: 83,
          opportunity: 59,
          band: "review",
          weights: {},
          notes: [],
        },
      },
      ai: null,
    });

    expect(result.html).toContain("In Your Corner Boxing");
    expect(result.html).toContain("Boxing · Fitness · Nutrition");
    expect(result.html).toContain("1 Wolcott Rd");
    expect(result.html).toContain("inyourcornerboxing@yahoo.com");
    expect(result.html).toContain("LocalBusiness");
    expect(result.html).toContain("static.wixstatic.com");
    expect(result.html).not.toContain("Draft site generated");
    expect(result.files?.some((file) => file.path === "coaches.html")).toBe(true);
    expect(result.files?.some((file) => file.path === "book.html")).toBe(true);
    expect(result.files?.some((file) => file.path === "styles.css")).toBe(true);
    expect(result.brief.fixesApplied.length).toBeGreaterThan(3);
    expect(fixesFromFindings([{ category: "ux", code: "no_contact_form", severity: "moderate", evidence: {}, source: "measured" }], "SOCIAL_ONLY")).toContain(
      "Replaced the social/directory presence with an official company homepage.",
    );
  });
});
