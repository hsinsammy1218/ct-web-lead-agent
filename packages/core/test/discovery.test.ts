import { describe, expect, it, vi } from "vitest";
import {
  buildDiscoveryQuery,
  classifyDiscoveryPlace,
  probeWebsiteOutdated,
  runDiscoveryScan,
} from "../src/discovery.js";
import type { ReferenceData } from "../src/types.js";

const reference: ReferenceData = {
  regions: [{ id: "nvcog", name: "Naugatuck Valley", cogName: "NVCOG", fips: "091" }],
  municipalities: [
    {
      opmCode: "168",
      name: "Wolcott",
      nameNormalized: "wolcott",
      planningRegionId: "nvcog",
    },
  ],
  industries: [{ slug: "fitness-gyms", displayName: "Fitness gyms", enabled: true, sortOrder: 1 }],
  denylist: [],
};

describe("discovery", () => {
  it("builds a CT text query", () => {
    expect(buildDiscoveryQuery("Fitness gyms", "Wolcott")).toBe("Fitness gyms in Wolcott, Connecticut");
  });

  it("flags missing and weak websites", () => {
    expect(
      classifyDiscoveryPlace({
        placeId: "1",
        businessName: "No Site Gym",
        address: "Wolcott, CT",
        phone: null,
        websiteUrl: null,
        mapsUrl: null,
        businessStatus: "OPERATIONAL",
      }).opportunity,
    ).toBe("no_website");

    expect(
      classifyDiscoveryPlace({
        placeId: "2",
        businessName: "FB Only",
        address: "Wolcott, CT",
        phone: null,
        websiteUrl: "https://www.facebook.com/fbonly",
        mapsUrl: null,
        businessStatus: "OPERATIONAL",
      }).opportunity,
    ).toBe("weak_website");
  });

  it("probes outdated signals", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<html><head><title>x</title></head><body>Copyright 2012 <marquee>old</marquee></body></html>', {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ) as unknown as typeof fetch;
    const result = await probeWebsiteOutdated("https://example.com", fetchImpl);
    expect(result.outdated).toBe(true);
  });

  it("runs a Places scan with a mocked API", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("places:searchText")) {
        return new Response(
          JSON.stringify({
            places: [
              {
                id: "places/abc",
                displayName: { text: "Corner Gym" },
                formattedAddress: "123 Main St, Wolcott, CT 06716",
                websiteUri: null,
                nationalPhoneNumber: "(860) 555-0100",
                googleMapsUri: "https://maps.google.com/?cid=1",
                businessStatus: "OPERATIONAL",
              },
              {
                id: "places/def",
                displayName: { text: "Modern Studio" },
                formattedAddress: "5 Oak St, Wolcott, CT 06716",
                websiteUri: "https://modernstudio.example",
                businessStatus: "OPERATIONAL",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("<html><title>Modern Studio</title><meta name='viewport' content='width=device-width'></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as unknown as typeof fetch;

    const result = await runDiscoveryScan({
      municipality: "Wolcott",
      industry: "fitness-gyms",
      apiKey: "test-key",
      reference,
      probeOutdated: true,
      fetchImpl,
    });
    expect(result.query).toContain("Wolcott");
    expect(result.summary.noWebsite).toBe(1);
    expect(result.candidates.some((item) => item.businessName === "Corner Gym")).toBe(true);
  });
});
