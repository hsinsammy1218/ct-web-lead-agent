import type { DraftSiteBrief } from "./site-draft.js";

export interface ProductionCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ProductionCheckResult {
  passed: boolean;
  checks: ProductionCheck[];
}

export function slugifySiteName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
}

export function buildGithubRepoName(businessName: string, leadId: string): string {
  const slug = slugifySiteName(businessName);
  const short = leadId.replaceAll("-", "").slice(0, 8);
  return `ct-site-${slug}-${short}`.slice(0, 100);
}

export function buildPublishFiles(input: {
  html: string;
  brief: DraftSiteBrief;
  businessName: string;
  municipality: string;
}): Array<{ path: string; content: string }> {
  const readme = `# ${input.businessName}

Auto-generated Connecticut business website draft for ${input.municipality}, CT.

This repository was created by CT Web Lead Agent after an audit. Review before taking it live with a custom domain.

## Local preview

Open \`index.html\` in a browser, or deploy with Vercel.

## Audit brief

- Opportunity: ${input.brief.opportunity ?? "n/a"}
- Recommended service: ${input.brief.recommendedService ?? "n/a"}
- Generated: ${input.brief.generatedAt}

### Fixes applied

${input.brief.fixesApplied.map((fix) => `- ${fix}`).join("\n")}
`;

  return [
    { path: "index.html", content: input.html },
    { path: "brief.json", content: `${JSON.stringify(input.brief, null, 2)}\n` },
    { path: "README.md", content: readme },
    {
      path: "vercel.json",
      content: `${JSON.stringify(
        {
          cleanUrls: true,
          headers: [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              ],
            },
          ],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "package.json",
      content: `${JSON.stringify(
        {
          name: slugifySiteName(input.businessName),
          private: true,
          version: "1.0.0",
          description: `Generated site for ${input.businessName}`,
        },
        null,
        2,
      )}\n`,
    },
  ];
}

export function runHtmlProductionChecks(html: string, businessName: string): ProductionCheckResult {
  const checks: ProductionCheck[] = [
    check("Has document title", /<title>[^<]+<\/title>/i.test(html), "title tag present"),
    check("Has meta description", /<meta[^>]+name=["']description["'][^>]*>/i.test(html), "meta description present"),
    check("Has mobile viewport", /name=["']viewport["']/i.test(html), "viewport meta present"),
    check("Declares language", /<html[^>]+lang=/i.test(html), "html lang attribute present"),
    check("Has one primary heading", (html.match(/<h1[\s>]/gi) ?? []).length === 1, "exactly one h1"),
    check("Includes business name", html.toLowerCase().includes(businessName.toLowerCase()), "business name appears in HTML"),
    check("Has contact path", /href=["']tel:|id=["']contact["']|<form[\s>]/i.test(html), "phone link or contact form present"),
    check("Has LocalBusiness schema", /LocalBusiness/i.test(html), "JSON-LD LocalBusiness present"),
    check("No leftover placeholders", !/TODO|lorem ipsum|example\.com\/replace/i.test(html), "no unfinished placeholders"),
  ];
  return { passed: checks.every((item) => item.ok), checks };
}

export async function runLiveProductionChecks(url: string, businessName: string): Promise<ProductionCheckResult> {
  const checks: ProductionCheck[] = [];
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    checks.push(check("Live URL responds", response.ok, `status ${response.status}`));
    checks.push(check("Serves HTML", /text\/html/i.test(contentType), contentType || "missing content-type"));
    checks.push(check("Live page includes business name", body.toLowerCase().includes(businessName.toLowerCase()), "name found in response"));
    checks.push(check("Live page has contact path", /href=["']tel:|id=["']contact["']|<form[\s>]/i.test(body), "phone or form found live"));
    const htmlChecks = runHtmlProductionChecks(body, businessName);
    checks.push(...htmlChecks.checks.map((item) => ({ ...item, name: `Live: ${item.name}` })));
  } catch (error) {
    checks.push(check("Live URL reachable", false, error instanceof Error ? error.message : "fetch failed"));
  }
  return { passed: checks.every((item) => item.ok), checks };
}

function check(name: string, ok: boolean, detail: string): ProductionCheck {
  return { name, ok, detail };
}
