import { describe, expect, it } from "vitest";
import { buildDraftSite } from "../src/site-draft.js";
import { extractSiteContent, siteModeFromHost } from "../src/site-extract.js";
import { buildProfessionalSite } from "../src/site-professional.js";

const baseInput = {
  leadId: "00000000-0000-0000-0000-000000000099",
  businessName: "Harbor Plumbing Co",
  municipality: "Bridgeport",
  planningRegion: "Connecticut Metropolitan",
  industry: "Home services",
  phone: "203-555-0142",
  currentUrl: "https://harborplumbing.example/",
  findings: [
    { category: "seo" as const, code: "missing_meta_description", severity: "moderate" as const, evidence: {}, source: "measured" as const },
  ],
  score: {
    quality: 48,
    need: 52,
    qualification: 100,
    contact: 40,
    confidence: 80,
    opportunity: 62,
    band: "pursue" as const,
    recommendedService: "redesign" as const,
    explanation: {
      formula: "test",
      quality: 48,
      need: 52,
      qualification: 100,
      contact: 40,
      confidence: 80,
      opportunity: 62,
      band: "pursue",
      weights: {},
      notes: [],
    },
  },
  ai: null,
};

describe("professional site generation", () => {
  it("classifies social leads as new sites and operator redesigns as updates", () => {
    expect(siteModeFromHost("SOCIAL_ONLY", "new_site")).toBe("new");
    expect(siteModeFromHost("OPERATOR_SITE", "redesign")).toBe("update");
    expect(siteModeFromHost("OPERATOR_SITE", "new_site")).toBe("new");
  });

  it("extracts content and media from source HTML", () => {
    const html = `<!doctype html><html><head>
      <title>Harbor Plumbing</title>
      <meta name="description" content="Plumbing in Bridgeport, CT">
    </head><body>
      <h1>Harbor Plumbing Co</h1>
      <h2>Emergency service</h2>
      <p>We fix leaks fast for homes across Bridgeport and nearby towns with clear pricing.</p>
      <img src="https://cdn.example.com/van.jpg" alt="Service van">
      <a href="mailto:hello@harborplumbing.example">Email</a>
      <a href="tel:2035550142">Call</a>
      <a href="https://www.instagram.com/harborplumbing/">Instagram</a>
    </body></html>`;
    const extracted = extractSiteContent(html, "https://harborplumbing.example/");
    expect(extracted.description).toContain("Bridgeport");
    expect(extracted.paragraphs[0]).toContain("leaks");
    expect(extracted.images[0]?.src).toContain("van.jpg");
    expect(extracted.emails[0]).toBe("hello@harborplumbing.example");
    expect(extracted.phones.length).toBeGreaterThan(0);
    expect(extracted.socialLinks[0]?.href).toContain("instagram.com");
  });

  it("builds a multi-page update from source HTML for operator sites", () => {
    const sourceHtml = `<!doctype html><html><head>
      <title>Harbor Plumbing</title>
      <meta name="description" content="Trusted plumbers in Bridgeport">
    </head><body>
      <p>Harbor Plumbing Co has served Bridgeport families for years with honest estimates and clean work.</p>
      <img src="https://images.example.com/crew.jpg" alt="Crew on site">
      <a href="mailto:jobs@harborplumbing.example">jobs@harborplumbing.example</a>
    </body></html>`;

    const result = buildProfessionalSite({
      ...baseInput,
      hostClass: "OPERATOR_SITE",
      sourceHtml,
    });

    expect(result.mode).toBe("update");
    expect(result.brief.summary.toLowerCase()).toContain("update");
    expect(result.files?.map((f) => f.path).sort()).toEqual([
      "about.html",
      "contact.html",
      "index.html",
      "services.html",
      "styles.css",
    ]);
    expect(result.html).toContain("Harbor Plumbing Co");
    expect(result.html).toContain("images.example.com/crew.jpg");
    expect(result.html).toContain("LocalBusiness");
    const contact = result.files?.find((f) => f.path === "contact.html")?.content ?? "";
    expect(contact).toContain("jobs@harborplumbing.example");
  });

  it("builds a multi-page new site for social-only leads", () => {
    const result = buildDraftSite({
      ...baseInput,
      hostClass: "SOCIAL_ONLY",
      currentUrl: "https://www.instagram.com/harborplumbing/",
      score: { ...baseInput.score, recommendedService: "new_site" },
      sourceHtml: null,
    });

    expect(result.files?.some((f) => f.path === "services.html")).toBe(true);
    expect(result.files?.some((f) => f.path === "about.html")).toBe(true);
    expect(result.brief.summary.toLowerCase()).toMatch(/new professional website/);
    expect(result.html).toContain("Harbor Plumbing Co");
    expect(result.html).toContain("Bridgeport");
  });
});
