import { describe, expect, it } from "vitest";
import { buildDraftSite } from "../src/site-draft.js";
import { extractSiteContent, siteModeFromHost } from "../src/site-extract.js";
import { buildProfessionalSite } from "../src/site-professional.js";

const baseInput = {
  leadId: "00000000-0000-0000-0000-000000000099",
  businessName: "Iron Ring Boxing",
  municipality: "Bridgeport",
  planningRegion: "Connecticut Metropolitan",
  industry: "Boxing gyms",
  phone: "203-555-0142",
  currentUrl: "https://ironringboxing.example/",
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

describe("fitness professional site generation", () => {
  it("classifies social leads as new sites and operator redesigns as updates", () => {
    expect(siteModeFromHost("SOCIAL_ONLY", "new_site")).toBe("new");
    expect(siteModeFromHost("OPERATOR_SITE", "redesign")).toBe("update");
    expect(siteModeFromHost("OPERATOR_SITE", "new_site")).toBe("new");
  });

  it("extracts content and media from source HTML", () => {
    const html = `<!doctype html><html><head>
      <title>Iron Ring Boxing</title>
      <meta name="description" content="Boxing gym in Bridgeport, CT">
    </head><body>
      <h1>Iron Ring Boxing</h1>
      <h2>Adult boxing</h2>
      <p>We coach real boxing skills for beginners and competitors across Bridgeport with clear class times.</p>
      <img src="https://cdn.example.com/bags.jpg" alt="Heavy bags">
      <a href="mailto:hello@ironringboxing.example">Email</a>
      <a href="tel:2035550142">Call</a>
      <a href="https://www.instagram.com/ironringboxing/">Instagram</a>
    </body></html>`;
    const extracted = extractSiteContent(html, "https://ironringboxing.example/");
    expect(extracted.description).toContain("Bridgeport");
    expect(extracted.paragraphs[0]).toContain("boxing");
    expect(extracted.images[0]?.src).toContain("bags.jpg");
    expect(extracted.emails[0]).toBe("hello@ironringboxing.example");
    expect(extracted.phones.length).toBeGreaterThan(0);
    expect(extracted.socialLinks[0]?.href).toContain("instagram.com");
  });

  it("builds a multi-page fitness update from source HTML", () => {
    const sourceHtml = `<!doctype html><html><head>
      <title>Iron Ring Boxing</title>
      <meta name="description" content="Boxing and fitness in Bridgeport">
    </head><body>
      <p>Iron Ring Boxing has trained Bridgeport athletes for years with mitts, bags, and coaching that feels like family.</p>
      <img src="https://images.example.com/ring.jpg" alt="Boxing ring">
      <a href="mailto:coach@ironringboxing.example">coach@ironringboxing.example</a>
    </body></html>`;

    const result = buildProfessionalSite({
      ...baseInput,
      hostClass: "OPERATOR_SITE",
      sourceHtml,
    });

    expect(result.mode).toBe("update");
    expect(result.brief.summary.toLowerCase()).toContain("fitness website update");
    expect(result.files?.map((f) => f.path).sort()).toEqual([
      "about.html",
      "book.html",
      "classes.html",
      "index.html",
      "styles.css",
    ]);
    expect(result.html).toContain("Iron Ring Boxing");
    expect(result.html).toContain("images.example.com/ring.jpg");
    expect(result.html).toContain("HealthClub");
    expect(result.html).toContain("Book a class");
    const book = result.files?.find((f) => f.path === "book.html")?.content ?? "";
    expect(book).toContain("coach@ironringboxing.example");
  });

  it("builds a multi-page new fitness site for social-only leads", () => {
    const result = buildDraftSite({
      ...baseInput,
      hostClass: "SOCIAL_ONLY",
      currentUrl: "https://www.instagram.com/ironringboxing/",
      score: { ...baseInput.score, recommendedService: "new_site" },
      sourceHtml: null,
    });

    expect(result.files?.some((f) => f.path === "classes.html")).toBe(true);
    expect(result.files?.some((f) => f.path === "book.html")).toBe(true);
    expect(result.brief.summary.toLowerCase()).toMatch(/new fitness website/);
    expect(result.html).toContain("Iron Ring Boxing");
    expect(result.html).toContain("Bridgeport");
    expect(result.html).toContain("Classes");
  });
});
