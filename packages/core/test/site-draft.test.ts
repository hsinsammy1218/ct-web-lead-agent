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

    expect(result.html).toContain("<title>In your corner fitness | Wolcott, CT</title>");
    expect(result.html).toContain('name="description"');
    expect(result.html).toContain("<h1>In your corner fitness</h1>");
    expect(result.html).toContain('id="contact"');
    expect(result.html).toContain("LocalBusiness");
    expect(result.html).toContain('aria-label="In your corner fitness serving Wolcott Connecticut"');
    expect(result.brief.recommendedService).toBe("local_seo");
    expect(result.brief.fixesApplied.length).toBeGreaterThan(3);
    expect(fixesFromFindings([{ category: "ux", code: "no_contact_form", severity: "moderate", evidence: {}, source: "measured" }], "SOCIAL_ONLY")).toContain(
      "Replaced the social/directory presence with a company homepage draft.",
    );
  });
});
