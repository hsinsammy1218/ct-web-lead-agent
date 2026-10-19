import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv.js";
import {
  decideDuplicate,
  decideExistingSubmission,
  existingSkipMessage,
  submissionFromCsvRow,
  validateSubmission,
} from "../src/intake.js";
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
  ],
  industries: [
    { slug: "roofing", displayName: "Roofing companies", enabled: true, sortOrder: 1 },
    { slug: "restaurants", displayName: "Restaurants", enabled: false, sortOrder: 2 },
  ],
  denylist: [],
};

describe("intake", () => {
  it("accepts a Connecticut municipality and configured industry", () => {
    const result = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "roofing",
        websiteUrl: "https://harborroofing.example",
        phone: "(860) 555-0100",
      },
      data,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.registrableDomain).toBe("harborroofing.example");
      expect(result.value.phone).toBe("+18605550100");
      expect(result.value.municipality.name).toBe("Hartford");
    }
  });

  it("rejects towns outside the Connecticut list and disabled industries", () => {
    const town = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Springfield",
        industry: "roofing",
        websiteUrl: "https://harborroofing.example",
      },
      data,
    );
    expect(town.ok).toBe(false);
    const industry = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "restaurants",
        websiteUrl: "https://harborroofing.example",
      },
      data,
    );
    expect(industry.ok).toBe(false);
  });

  it("rejects private and non-http URLs", () => {
    const result = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "Roofing companies",
        websiteUrl: "http://127.0.0.1/admin",
      },
      data,
    );
    expect(result.ok).toBe(false);
  });

  it("parses the CSV contract and skips duplicate domains unless overridden", () => {
    const rows = parseCsv(
      'business_name,municipality,industry,website_url,phone\n"Harbor Roofing",Hartford,roofing,https://harborroofing.example,8605550100\n,bad,,,\n',
    );
    expect(rows).toHaveLength(2);
    const first = rows[0];
    expect(first).toBeDefined();
    const parsed = submissionFromCsvRow(first!.values);
    expect(parsed.businessName).toBe("Harbor Roofing");
    expect(decideDuplicate(true, false)).toBe("skip");
    expect(decideDuplicate(true, true)).toBe("create");
    expect(decideDuplicate(false, false)).toBe("create");
  });

  it("skips already-audited websites and businesses", () => {
    expect(
      decideExistingSubmission(
        { leadId: "1", match: "domain", audited: true, displayName: "Harbor" },
        true,
      ),
    ).toBe("skip");
    expect(
      decideExistingSubmission(
        { leadId: "1", match: "business", audited: false, displayName: "Harbor" },
        true,
      ),
    ).toBe("skip");
    expect(
      decideExistingSubmission(
        { leadId: "1", match: "domain", audited: false, displayName: "Harbor" },
        false,
      ),
    ).toBe("skip");
    expect(
      decideExistingSubmission(
        { leadId: "1", match: "domain", audited: false, displayName: "Harbor" },
        true,
      ),
    ).toBe("create");
    expect(
      existingSkipMessage({ leadId: "1", match: "domain", audited: true, displayName: "Harbor" }),
    ).toContain("already on file and audited");
  });
});
