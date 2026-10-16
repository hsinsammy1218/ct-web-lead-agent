import type { Assessment } from "./ai.js";
import type { Finding, LeadScore, RecommendedService } from "./types.js";

export interface DraftSiteInput {
  leadId: string;
  businessName: string;
  municipality: string;
  planningRegion: string;
  industry: string;
  phone: string | null;
  currentUrl: string;
  hostClass: string;
  findings: Finding[];
  score: LeadScore | null;
  ai: Assessment | null;
}

export interface DraftSiteResult {
  html: string;
  brief: DraftSiteBrief;
}

export interface DraftSiteBrief {
  leadId: string;
  businessName: string;
  generatedAt: string;
  recommendedService: RecommendedService | null;
  opportunity: number | null;
  band: string | null;
  currentUrl: string;
  fixesApplied: string[];
  findingsAddressed: string[];
  summary: string;
}

const FIX_COPY: Record<string, string> = {
  missing_title: "Added a clear page title with the business name and town.",
  title_length: "Set a concise title under 60 characters.",
  missing_meta_description: "Wrote a unique meta description for local search.",
  heading_structure: "Used one H1 for the business name and supporting H2 sections.",
  missing_canonical: "Included a self-referencing canonical placeholder.",
  missing_local_business_schema: "Added LocalBusiness JSON-LD with name and locality.",
  no_click_to_call: "Added a click-to-call button in the hero and footer.",
  no_email: "Added a contact form so visitors can reach the business without guessing an email.",
  no_contact_form: "Added a contact / quote request form.",
  no_nav: "Added a simple top navigation.",
  no_street_address: "Highlighted the Connecticut municipality for local relevance.",
  images_missing_alt: "Included an image block with descriptive alt text.",
  missing_viewport: "Set a mobile viewport meta tag.",
  missing_lang: "Set html lang to en.",
  not_an_official_site: "Replaced the social/directory presence with a company homepage draft.",
  access_blocked: "Built a new homepage draft because the live site could not be audited.",
  fetch_failed: "Built a new homepage draft because the live site could not be fetched.",
  business_name_not_on_page: "Put the submitted business name in the H1 and title.",
};

export function fixesFromFindings(findings: Finding[], hostClass: string): string[] {
  const codes = new Set(findings.map((finding) => finding.code));
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY" || hostClass === "PLATFORM_SITE") {
    codes.add("not_an_official_site");
  }
  if (hostClass === "BLOCKED") codes.add("access_blocked");
  if (hostClass === "UNREACHABLE") codes.add("fetch_failed");
  // Always include core local-site fixes on a generated draft.
  for (const code of [
    "missing_meta_description",
    "heading_structure",
    "no_click_to_call",
    "no_contact_form",
    "missing_local_business_schema",
    "missing_viewport",
    "images_missing_alt",
  ]) {
    codes.add(code);
  }
  return [...codes]
    .map((code) => FIX_COPY[code])
    .filter((text): text is string => Boolean(text));
}

export function buildDraftSite(input: DraftSiteInput): DraftSiteResult {
  const generatedAt = new Date().toISOString();
  const findingsAddressed = [...new Set(input.findings.map((finding) => finding.code))];
  const fixesApplied = [...new Set(fixesFromFindings(input.findings, input.hostClass))];
  const service = input.score?.recommendedService ?? input.ai?.recommended_service ?? null;
  const phone = input.phone ?? null;
  const phoneDisplay = phone ?? "Add your phone number";
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "#contact";
  const title = `${input.businessName} | ${input.municipality}, CT`;
  const description = `${input.businessName} serves ${input.municipality} and the ${input.planningRegion} region. ${input.industry}. Request a quote online.`;
  const recommendation =
    input.ai?.rationale ??
    (service === "new_site"
      ? "This draft is a new company homepage to replace a weak or missing official site."
      : service === "local_seo"
        ? "This draft strengthens local SEO, contact paths, and on-page clarity."
        : service === "redesign"
          ? "This draft is a cleaner redesign focused on mobile UX and conversion."
          : "This draft applies the measured audit findings to a simpler local homepage.");

  const brief: DraftSiteBrief = {
    leadId: input.leadId,
    businessName: input.businessName,
    generatedAt,
    recommendedService: service,
    opportunity: input.score?.opportunity ?? null,
    band: input.score?.band ?? null,
    currentUrl: input.currentUrl,
    fixesApplied,
    findingsAddressed,
    summary: recommendation,
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.businessName,
    url: input.currentUrl,
    telephone: phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.municipality,
      addressRegion: "CT",
      addressCountry: "US",
    },
    areaServed: input.municipality,
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(input.currentUrl)}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    :root { --ink:#1c2430; --paper:#f7f4ee; --pine:#0f6e56; --line:#e3d9c8; --muted:#5b6573; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:"IBM Plex Sans",Segoe UI,sans-serif; color:var(--ink); background:linear-gradient(180deg,#eef5f1 0%,var(--paper) 36%,#f3efe6 100%); }
    a { color:inherit; }
    .wrap { width:min(1080px, calc(100% - 2rem)); margin:0 auto; }
    header { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1.25rem 0; }
    .brand { font-family:"IBM Plex Serif",Georgia,serif; font-size:1.35rem; }
    nav { display:flex; gap:1rem; flex-wrap:wrap; font-size:.95rem; }
    .hero { padding:3.5rem 0 2.5rem; display:grid; gap:1.5rem; }
    h1 { font-family:"IBM Plex Serif",Georgia,serif; font-size:clamp(2.2rem,5vw,3.6rem); line-height:1.05; margin:0; max-width:12ch; }
    .lede { max-width:36rem; color:var(--muted); font-size:1.05rem; }
    .actions { display:flex; flex-wrap:wrap; gap:.75rem; }
    .btn { display:inline-block; border-radius:.55rem; padding:.85rem 1.15rem; text-decoration:none; font-weight:600; }
    .btn-primary { background:var(--pine); color:#fff; }
    .btn-secondary { border:1px solid var(--line); background:#fff; }
    section { padding:2rem 0; }
    .panel { background:#fff; border:1px solid var(--line); border-radius:1rem; padding:1.25rem; }
    .grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
    h2 { font-family:"IBM Plex Serif",Georgia,serif; font-size:1.7rem; margin:0 0 .75rem; }
    .photo { aspect-ratio: 16/10; border-radius:1rem; background:linear-gradient(135deg,#0f6e56,#87b7a8); display:grid; place-items:center; color:#fff; font-weight:600; }
    label { display:block; font-size:.9rem; margin-bottom:.35rem; }
    input, textarea { width:100%; border:1px solid var(--line); border-radius:.5rem; padding:.7rem .8rem; font:inherit; margin-bottom:.8rem; }
    footer { padding:2rem 0 3rem; color:var(--muted); font-size:.9rem; }
    .badge { display:inline-block; background:#e7f3ee; color:var(--pine); border-radius:999px; padding:.25rem .7rem; font-size:.8rem; margin-bottom:1rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">${escapeHtml(input.businessName)}</div>
      <nav aria-label="Primary">
        <a href="#services">Services</a>
        <a href="#area">Service area</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <div>
          <p class="badge">${escapeHtml(input.municipality)}, Connecticut</p>
          <h1>${escapeHtml(input.businessName)}</h1>
          <p class="lede">${escapeHtml(input.industry)} serving ${escapeHtml(input.municipality)} and nearby towns in the ${escapeHtml(input.planningRegion)} region.</p>
          <div class="actions">
            <a class="btn btn-primary" href="${escapeHtml(phoneHref)}">${phone ? `Call ${escapeHtml(phoneDisplay)}` : "Request a quote"}</a>
            <a class="btn btn-secondary" href="#contact">Contact form</a>
          </div>
        </div>
        <div class="photo" role="img" aria-label="${escapeHtml(input.businessName)} serving ${escapeHtml(input.municipality)} Connecticut">
          Local ${escapeHtml(input.industry)}
        </div>
      </section>

      <section id="services">
        <h2>What we help with</h2>
        <div class="grid">
          <article class="panel"><h3>Local service</h3><p>Straightforward help for neighbors in ${escapeHtml(input.municipality)}.</p></article>
          <article class="panel"><h3>Clear next step</h3><p>Call or send a short message. No buried contact details.</p></article>
          <article class="panel"><h3>Mobile-ready</h3><p>Built to load cleanly on a phone with a visible call button.</p></article>
        </div>
      </section>

      <section id="area">
        <h2>Service area</h2>
        <div class="panel">
          <p>${escapeHtml(input.businessName)} is labeled for ${escapeHtml(input.municipality)}, CT (${escapeHtml(input.planningRegion)}).</p>
        </div>
      </section>

      <section id="contact">
        <h2>Request a quote</h2>
        <div class="panel">
          <form action="#" method="post">
            <label for="name">Name</label>
            <input id="name" name="name" required autocomplete="name">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel">
            <label for="message">How can we help?</label>
            <textarea id="message" name="message" rows="4" required></textarea>
            <button class="btn btn-primary" type="submit">Send message</button>
          </form>
          <p style="margin-top:1rem;color:var(--muted);font-size:.9rem;">Draft site generated from the audit. Wire this form to your inbox before publishing.</p>
        </div>
      </section>
    </main>

    <footer>
      <p>${escapeHtml(input.businessName)} · ${escapeHtml(input.municipality)}, CT</p>
      <p><a href="${escapeHtml(phoneHref)}">${escapeHtml(phoneDisplay)}</a></p>
    </footer>
  </div>
</body>
</html>
`;

  return { html, brief };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
