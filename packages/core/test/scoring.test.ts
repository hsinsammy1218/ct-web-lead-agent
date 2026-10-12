import { describe, expect, it } from "vitest";
import { scoreBand, scoreLead, websiteQuality } from "../src/scoring.js";

const base = {
  hasMunicipality: true,
  hasIndustry: true,
  hasName: true,
  normalizedName: "harbor roofing",
  denylist: ["home depot"],
  operatorPhone: true,
  pagePhone: false,
  pageEmail: false,
  contactForm: false,
  nameMentioned: true,
};

describe("scoring", () => {
  it("renormalizes quality over measured components and ignores design", () => {
    const quality = websiteQuality({
      performance: 50,
      mobile: null,
      seo: 100,
      ux: null,
      technical: null,
      design: 10,
    });
    expect(quality).toBe(71);
  });

  it("does not turn a quality score of 20 into an opportunity score of 80", () => {
    const score = scoreLead({
      ...base,
      hostClass: "OPERATOR_SITE",
      components: {
        performance: 20,
        mobile: null,
        seo: null,
        ux: null,
        technical: null,
        design: null,
      },
    });
    expect(score.quality).toBe(20);
    expect(score.opportunity).not.toBe(80);
    expect(score.opportunity).toBeLessThan(80);
    expect(score.explanation.formula).toContain("confidence");
  });

  it("leaves opportunity empty when the audit is blocked", () => {
    const score = scoreLead({
      ...base,
      hostClass: "BLOCKED",
      components: {
        performance: null,
        mobile: null,
        seo: null,
        ux: null,
        technical: null,
        design: null,
      },
      nameMentioned: null,
    });
    expect(score.quality).toBeNull();
    expect(score.need).toBeNull();
    expect(score.opportunity).toBeNull();
    expect(score.band).toBeNull();
    expect(score.recommendedService).toBe("insufficient_evidence");
    expect(score.confidence).toBeLessThanOrEqual(35);
  });

  it("caps national chains and scores social profiles without a quality number", () => {
    const chain = scoreLead({
      ...base,
      normalizedName: "home depot of hartford",
      hostClass: "OPERATOR_SITE",
      components: {
        performance: 40,
        mobile: 40,
        seo: 40,
        ux: 40,
        technical: 40,
        design: null,
      },
    });
    expect(chain.qualification).toBe(20);

    const social = scoreLead({
      ...base,
      hostClass: "SOCIAL_ONLY",
      components: {
        performance: 10,
        mobile: 10,
        seo: 10,
        ux: 10,
        technical: 10,
        design: null,
      },
    });
    expect(social.quality).toBeNull();
    expect(social.need).toBe(75);
    expect(social.recommendedService).toBe("new_site");
  });

  it("maps opportunity bands from the configured thresholds", () => {
    expect(scoreBand(90)).toBe("very_high");
    expect(scoreBand(80)).toBe("high");
    expect(scoreBand(70)).toBe("qualified");
    expect(scoreBand(50)).toBe("review");
    expect(scoreBand(49)).toBe("low");
  });
});
