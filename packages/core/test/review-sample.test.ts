import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateWebsite } from "../src/audit.js";
import { scoreLead } from "../src/scoring.js";
import type { HostClass } from "../src/types.js";

interface Sample {
  id: string;
  businessName: string;
  hostClass: HostClass;
  html?: string;
  statusCode?: number;
  blocked?: boolean;
  expectQuality: boolean;
}

const samples: Sample[] = [
  { id: "01-roofing", businessName: "North Roofing", hostClass: "OPERATOR_SITE", html: page("North Roofing", true), expectQuality: true },
  { id: "02-plumbing", businessName: "River Plumbing", hostClass: "OPERATOR_SITE", html: page("River Plumbing", false), expectQuality: true },
  { id: "03-hvac", businessName: "Elm HVAC", hostClass: "OPERATOR_SITE", html: page("Elm HVAC", true), expectQuality: true },
  { id: "04-electrical", businessName: "Oak Electric", hostClass: "OPERATOR_SITE", html: thin("Oak Electric"), expectQuality: true },
  { id: "05-landscaping", businessName: "Cedar Lawns", hostClass: "OPERATOR_SITE", html: thin("Cedar Lawns"), expectQuality: true },
  { id: "06-cleaning", businessName: "Maple Cleaners", hostClass: "OPERATOR_SITE", html: page("Maple Cleaners", true), expectQuality: true },
  { id: "07-auto", businessName: "Park Auto", hostClass: "OPERATOR_SITE", html: page("Park Auto", false), expectQuality: true },
  { id: "08-salon", businessName: "Pearl Salon", hostClass: "PLATFORM_SITE", html: page("Pearl Salon", true), expectQuality: true },
  { id: "09-barber", businessName: "Main Street Barber", hostClass: "SOCIAL_ONLY", expectQuality: false },
  { id: "10-restaurant", businessName: "Harbor Grill", hostClass: "DIRECTORY_ONLY", expectQuality: false },
  { id: "11-painting", businessName: "Birch Painting", hostClass: "OPERATOR_SITE", blocked: true, expectQuality: false },
  { id: "12-flooring", businessName: "Stone Flooring", hostClass: "OPERATOR_SITE", statusCode: 500, expectQuality: false },
  { id: "13-remodel", businessName: "Hill Remodel", hostClass: "OPERATOR_SITE", html: page("Someone Else", true), expectQuality: true },
  { id: "14-pressure", businessName: "Shore Wash", hostClass: "OPERATOR_SITE", html: page("Shore Wash", true), expectQuality: true },
  { id: "15-retail", businessName: "Town Goods", hostClass: "OPERATOR_SITE", html: page("Town Goods", false), expectQuality: true },
];

function page(name: string, complete: boolean): string {
  return `<!doctype html><html lang="en"><head><title>${name}</title>
  <meta name="description" content="${name} serves Connecticut.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${complete ? '<link rel="canonical" href="https://example.com/">' : ""}
  ${complete ? '<script type="application/ld+json">{"@type":"LocalBusiness"}</script>' : ""}
  </head><body><nav>Menu</nav><h1>${name}</h1>
  <p>10 Oak Street</p>
  ${complete ? '<a href="tel:+18605550100">Call</a><form action="/contact"><textarea></textarea></form>' : ""}
  <img alt="${name}" src="/a.jpg"></body></html>`;
}

function thin(name: string): string {
  return `<html><head><title>${name}</title></head><body><h1>${name}</h1><h1>Extra</h1></body></html>`;
}

describe("operator review sample", () => {
  it("covers 15 submitted sites without inventing websites or quality for failed fetches", () => {
    expect(samples).toHaveLength(15);
    const reviewed = samples.map((sample) => {
      const audit = evaluateWebsite({
        submittedUrl: "https://example.com",
        businessName: sample.businessName,
        initialHostClass: sample.hostClass,
        fetch: sample.blocked
          ? { finalUrl: null, statusCode: 403, html: null, error: "blocked", blocked: true }
          : sample.html
            ? { finalUrl: "https://example.com", statusCode: 200, html: sample.html, error: null, blocked: false }
            : sample.statusCode
              ? { finalUrl: "https://example.com", statusCode: sample.statusCode, html: null, error: "error", blocked: false }
              : null,
        psi: null,
        browser: null,
      });
      const score = scoreLead({
        hostClass: audit.hostClass,
        components: audit.components,
        hasMunicipality: true,
        hasIndustry: true,
        hasName: true,
        normalizedName: sample.businessName,
        denylist: [],
        operatorPhone: false,
        pagePhone: audit.pagePhone,
        pageEmail: audit.pageEmail,
        contactForm: audit.contactForm,
        nameMentioned: audit.nameMentioned,
      });
      return { sample, audit, score };
    });

    const socialOrDirectory = reviewed.filter((item) =>
      ["SOCIAL_ONLY", "DIRECTORY_ONLY"].includes(item.sample.hostClass),
    );
    expect(socialOrDirectory.every((item) => item.score.quality == null)).toBe(true);

    const blocked = reviewed.filter((item) => item.sample.blocked || item.sample.statusCode);
    expect(blocked.every((item) => item.score.quality == null && item.score.opportunity == null)).toBe(true);

    const fair = reviewed.filter((item) => item.sample.expectQuality && item.audit.summary.length > 20);
    expect(fair.length).toBeGreaterThanOrEqual(10);

    const high = reviewed.filter((item) => (item.score.opportunity ?? 0) >= 70);
    expect(high.every((item) => item.score.explanation.notes.length > 0)).toBe(true);
    expect(JSON.stringify(reviewed)).not.toMatch(/revenue|owner's email/i);

    const note = reviewed
      .map((item) => `${item.sample.id}: ${item.audit.auditStatus} quality=${item.score.quality ?? "blank"}`)
      .join("\n");
    expect(note.split("\n")).toHaveLength(15);
    expect(readFileSync(new URL("./review-sample.test.ts", import.meta.url), "utf8")).toContain("15 submitted sites");
  });
});
