import { describe, expect, it } from "vitest";
import { buildAssessmentPrompt, validateAssessment } from "../src/ai.js";
import { evaluateWebsite } from "../src/audit.js";
import { budgetAllows } from "../src/budget.js";
import { addressesArePublic, isPrivateAddress } from "../src/ssrf.js";
import { classifyHost } from "../src/url.js";

const html = `<!doctype html><html lang="en"><head>
<title>Harbor Roofing in Hartford</title>
<meta name="description" content="Roof repair and replacement in Hartford, Connecticut.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://harborroofing.example/">
<script type="application/ld+json">{"@type":"LocalBusiness","name":"Harbor Roofing"}</script>
</head><body>
<nav><a href="/services">Services</a></nav>
<h1>Harbor Roofing</h1>
<p>12 Main Street, Hartford CT</p>
<a href="tel:+18605550100">Call</a>
<form action="/contact"><textarea name="message"></textarea></form>
<img src="/roof.jpg" alt="Shingle roof">
</body></html>`;

describe("website classification and audit", () => {
  it("classifies social, directory, and platform hosts", () => {
    expect(classifyHost("https://www.facebook.com/harborroofing")).toBe("SOCIAL_ONLY");
    expect(classifyHost("https://www.yelp.com/biz/harbor-roofing")).toBe("DIRECTORY_ONLY");
    expect(classifyHost("https://harbor.square.site")).toBe("PLATFORM_SITE");
    expect(classifyHost("https://harborroofing.example")).toBe("OPERATOR_SITE");
  });

  it("does not assign quality when the submitted URL is social or blocked", () => {
    const social = evaluateWebsite({
      submittedUrl: "https://facebook.com/harbor",
      businessName: "Harbor Roofing",
      initialHostClass: "SOCIAL_ONLY",
      fetch: null,
      psi: null,
      browser: null,
    });
    expect(social.auditStatus).toBe("skipped");
    expect(social.components.seo).toBeNull();

    const blocked = evaluateWebsite({
      submittedUrl: "https://harborroofing.example",
      businessName: "Harbor Roofing",
      initialHostClass: "OPERATOR_SITE",
      fetch: { finalUrl: null, statusCode: 403, html: null, error: "Forbidden", blocked: true },
      psi: null,
      browser: null,
    });
    expect(blocked.auditStatus).toBe("blocked");
    expect(blocked.components.performance).toBeNull();
    expect(blocked.summary).toMatch(/not treated as a poor website/i);
  });

  it("records measured findings from fixture HTML", () => {
    const audit = evaluateWebsite({
      submittedUrl: "https://harborroofing.example",
      businessName: "Harbor Roofing",
      initialHostClass: "OPERATOR_SITE",
      fetch: {
        finalUrl: "https://harborroofing.example/",
        statusCode: 200,
        html,
        error: null,
        blocked: false,
      },
      psi: {
        mobilePerformance: 42,
        desktopPerformance: 70,
        lcpMs: 3200,
        inpMs: 180,
        cls: 0.05,
      },
      browser: { horizontalOverflow: false, consoleErrorCount: 0, hasVisibleTel: true, screenshotCaptured: false },
    });
    expect(audit.auditStatus).toBe("completed");
    expect(audit.nameMentioned).toBe(true);
    expect(audit.pagePhone).toBe(true);
    expect(audit.components.performance).toBe(42);
    expect(audit.components.seo).toBeGreaterThan(70);
    expect(audit.htmlSha256).toHaveLength(64);
    expect(audit.findings.every((finding) => finding.source === "measured")).toBe(true);
  });

  it("rejects invented AI claims and private addresses", () => {
    expect(() =>
      validateAssessment({
        verified_findings: [],
        inferences: [],
        unknowns: ["Budget is unknown"],
        recommended_service: "redesign",
        redesign_justified: true,
        rationale: "The homepage is missing a contact form.",
        confidence: 40,
      }),
    ).toThrow(/invent/i);

    expect(() =>
      validateAssessment({
        verified_findings: [{ statement: "No title", evidence_code: "missing_title" }],
        inferences: ["A redesign would help the contact path."],
        unknowns: ["Search rankings are unknown."],
        recommended_service: "redesign",
        redesign_justified: true,
        rationale: "The measured page has no title element.",
        confidence: 55,
      }),
    ).not.toThrow();

    const prompt = buildAssessmentPrompt({
      businessName: "Harbor Roofing",
      municipality: "Hartford",
      industry: "Roofing companies",
      hostClass: "OPERATOR_SITE",
      findings: [],
    });
    expect(prompt).toMatch(/untrusted evidence/i);
    expect(isPrivateAddress("10.1.1.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(() => addressesArePublic(["169.254.169.254"])).toThrow(/private/i);
  });

  it("stops paid calls when the daily or monthly cap is reached", () => {
    expect(
      budgetAllows(
        { spentDayUsd: 4.9, spentMonthUsd: 10, dailyCapUsd: 5, monthlyCapUsd: 50 },
        0.2,
      ).ok,
    ).toBe(false);
    expect(
      budgetAllows(
        { spentDayUsd: 1, spentMonthUsd: 49.9, dailyCapUsd: 5, monthlyCapUsd: 50 },
        0.2,
      ).ok,
    ).toBe(false);
    expect(
      budgetAllows({ spentDayUsd: 0, spentMonthUsd: 0, dailyCapUsd: 5, monthlyCapUsd: 50 }, 0).ok,
    ).toBe(true);
  });
});
