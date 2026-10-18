import { describe, expect, it } from "vitest";
import { buildGithubRepoName, buildPublishFiles, runHtmlProductionChecks } from "../src/site-publish.js";
import { buildDraftSite } from "../src/site-draft.js";

describe("site publish helpers", () => {
  it("names repos safely and packages deployable files", () => {
    const name = buildGithubRepoName("In your corner fitness!", "af124d15-bc91-4563-9881-003f6edbbf24");
    expect(name).toMatch(/^ct-site-in-your-corner-fitness-af124d15$/);
    const draft = buildDraftSite({
      leadId: "af124d15-bc91-4563-9881-003f6edbbf24",
      businessName: "In your corner fitness",
      municipality: "Wolcott",
      planningRegion: "Naugatuck Valley",
      industry: "Local professional services",
      phone: "+18605550100",
      currentUrl: "https://www.inyourcornerfitness.com/",
      hostClass: "OPERATOR_SITE",
      findings: [],
      score: null,
      ai: null,
    });
    const files = buildPublishFiles({
      html: draft.html,
      brief: draft.brief,
      businessName: "In your corner fitness",
      municipality: "Wolcott",
      extraFiles: draft.files,
    });
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "README.md",
        "brief.json",
        "index.html",
        "package.json",
        "vercel.json",
        "styles.css",
        "coaches.html",
        "book.html",
      ]),
    );
    const checks = runHtmlProductionChecks(draft.html, draft.brief.businessName);
    expect(checks.passed).toBe(true);
  });
});
