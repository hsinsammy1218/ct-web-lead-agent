import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateSubmission, type ReferenceData } from "@ct/core";
import { MemoryStore } from "../src/memory-store.js";

const reference: ReferenceData = {
  regions: [{ id: "capitol", name: "Capitol", cogName: "Capitol Planning Region", fips: "9110" }],
  municipalities: [
    { opmCode: "1", name: "Hartford", nameNormalized: "hartford", planningRegionId: "capitol" },
  ],
  industries: [{ slug: "roofing", displayName: "Roofing companies", enabled: true, sortOrder: 1 }],
  denylist: [],
};

function store(): MemoryStore {
  return new MemoryStore(path.join(mkdtempSync(path.join(tmpdir(), "ct-")), "store.json"), reference);
}

describe("memory store", () => {
  it("queues one audit and skips a second submission of the same domain", async () => {
    const memory = store();
    const input = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "roofing",
        websiteUrl: "https://harbor.example",
      },
      reference,
    );
    if (!input.ok) throw new Error(input.message);
    const first = await memory.submit(input.value, "operator@example.com", false);
    const second = await memory.submit(input.value, "operator@example.com", false);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.skipped).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.leadId).toBe(first.leadId);
    expect((await memory.listWork()).filter((item) => item.jobType === "website.audit")).toHaveLength(1);
    const claimed = await memory.claim();
    expect(claimed?.payload.leadId).toBe(first.leadId);
    expect(await memory.claim()).toBeNull();
  });

  it("skips when the same business name is already on file under a different domain", async () => {
    const memory = store();
    const firstInput = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "roofing",
        websiteUrl: "https://harbor.example",
      },
      reference,
    );
    const secondInput = validateSubmission(
      {
        businessName: "Harbor Roofing",
        municipality: "Hartford",
        industry: "roofing",
        websiteUrl: "https://harbor-roofing.example",
      },
      reference,
    );
    if (!firstInput.ok || !secondInput.ok) throw new Error("validation failed");
    const first = await memory.submit(firstInput.value, "operator@example.com", false);
    const second = await memory.submit(secondInput.value, "operator@example.com", true);
    expect(first.ok).toBe(true);
    expect(second.skipped).toBe(true);
    expect(second.leadId).toBe(first.leadId);
    expect((await memory.listWork()).filter((item) => item.jobType === "website.audit")).toHaveLength(1);
  });

  it("imports a mixed CSV and filters the lead list", async () => {
    const memory = store();
    const result = await memory.importCsv(
      "business_name,municipality,industry,website_url\nHarbor Roofing,Hartford,roofing,https://harbor.example\nNope,Boston,roofing,https://nope.example\n",
      "operator@example.com",
      false,
    );
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(await memory.listLeads({ municipality: "Hartford" })).toHaveLength(1);
    expect(await memory.exportCsv()).toContain("Harbor Roofing");
    expect(await memory.exportCsv()).not.toContain("html");
  });
});
