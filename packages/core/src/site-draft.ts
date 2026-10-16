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

interface IndustryPack {
  kind: string;
  headline: string;
  lede: string;
  description: string;
  services: Array<{ title: string; body: string }>;
  about: string;
  heroImage: string;
  heroAlt: string;
  gallery: Array<{ src: string; alt: string }>;
  cta: string;
  formTitle: string;
  formBlurb: string;
  schemaType: string;
}

const FIX_COPY: Record<string, string> = {
  missing_title: "Added a clear page title with the business name and town.",
  title_length: "Set a concise title under 60 characters.",
  missing_meta_description: "Wrote a unique meta description for local search.",
  heading_structure: "Used one H1 for the business name and supporting H2 sections.",
  missing_canonical: "Included a self-referencing canonical URL.",
  missing_local_business_schema: "Added LocalBusiness JSON-LD with name and locality.",
  no_click_to_call: "Added a click-to-call button in the hero and footer.",
  no_email: "Added a contact form so visitors can reach the business.",
  no_contact_form: "Added a working contact / quote request form.",
  no_nav: "Added primary navigation.",
  no_street_address: "Highlighted the Connecticut municipality for local relevance.",
  images_missing_alt: "Included photography with descriptive alt text.",
  missing_viewport: "Set a mobile viewport meta tag.",
  missing_lang: "Set html lang to en.",
  not_an_official_site: "Replaced the social/directory presence with an official company homepage.",
  access_blocked: "Built a new homepage because the live site could not be audited.",
  fetch_failed: "Built a new homepage because the live site could not be fetched.",
  business_name_not_on_page: "Put the submitted business name in the H1 and title.",
};

export function fixesFromFindings(findings: Finding[], hostClass: string): string[] {
  const codes = new Set(findings.map((finding) => finding.code));
  if (hostClass === "SOCIAL_ONLY" || hostClass === "DIRECTORY_ONLY" || hostClass === "PLATFORM_SITE") {
    codes.add("not_an_official_site");
  }
  if (hostClass === "BLOCKED") codes.add("access_blocked");
  if (hostClass === "UNREACHABLE") codes.add("fetch_failed");
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
  const pack = resolveIndustryPack(input);
  const phone = input.phone ?? null;
  const phoneDigits = phone ? phone.replace(/[^\d+]/g, "") : null;
  const phoneHref = phoneDigits ? `tel:${phoneDigits}` : "#contact";
  const phoneDisplay = phone ?? "Request a callback";
  const title = `${input.businessName} | ${input.municipality}, CT`;
  const description = pack.description;
  const recommendation =
    input.ai?.rationale ??
    (service === "new_site"
      ? "Final company homepage ready to replace a weak or missing official site."
      : service === "local_seo"
        ? "Final local homepage with SEO, contact paths, and conversion clarity."
        : service === "redesign"
          ? "Final redesign focused on mobile UX and conversion."
          : "Final homepage built from the measured audit findings.");

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
    "@type": pack.schemaType === "LocalBusiness" ? "LocalBusiness" : ["LocalBusiness", pack.schemaType],
    name: input.businessName,
    url: input.currentUrl,
    telephone: phone ?? undefined,
    image: pack.heroImage,
    description,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.municipality,
      addressRegion: "CT",
      addressCountry: "US",
    },
    areaServed: [`${input.municipality}, CT`, input.planningRegion],
  };

  const mailtoSubject = encodeURIComponent(`Website inquiry — ${input.businessName}`);
  const formAction = `mailto:${contactEmail(input)}?subject=${mailtoSubject}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(input.currentUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${escapeHtml(pack.heroImage)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    :root {
      --ink: #12171f;
      --paper: #f4f1ea;
      --pine: #0d5c49;
      --pine-deep: #084536;
      --sand: #e7dfd1;
      --line: #d9d0c2;
      --muted: #5a6470;
      --white: #fffdf8;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: "DM Sans", Segoe UI, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 500px at 10% -10%, #d7ebe3 0%, transparent 55%),
        linear-gradient(180deg, #eef3ef 0%, var(--paper) 28%, #efe9de 100%);
    }
    a { color: inherit; }
    img { display: block; max-width: 100%; }
    .wrap { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; }
    .site-header {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      padding: 1.1rem 0; position: sticky; top: 0; z-index: 20;
      backdrop-filter: blur(10px); background: color-mix(in srgb, var(--paper) 82%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
    }
    .brand { font-family: "Instrument Serif", Georgia, serif; font-size: 1.55rem; letter-spacing: -0.02em; }
    nav { display: flex; gap: 1.1rem; flex-wrap: wrap; font-size: 0.95rem; }
    nav a { text-decoration: none; color: var(--muted); }
    nav a:hover { color: var(--ink); }
    .hero {
      min-height: calc(100svh - 4.5rem);
      display: grid; align-items: end;
      padding: 2.5rem 0 2rem;
      position: relative;
    }
    .hero-media {
      position: absolute; inset: 0; border-radius: 1.25rem; overflow: hidden;
      box-shadow: 0 30px 80px rgba(18, 23, 31, 0.18);
    }
    .hero-media img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.02); }
    .hero-media::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(180deg, rgba(8,20,16,0.18) 0%, rgba(8,20,16,0.55) 48%, rgba(8,20,16,0.82) 100%);
    }
    .hero-copy {
      position: relative; z-index: 1; color: var(--white);
      max-width: 38rem; padding: 1.5rem; animation: rise 700ms ease both;
    }
    .badge {
      display: inline-block; margin-bottom: 1rem; padding: 0.3rem 0.75rem;
      border: 1px solid rgba(255,255,255,0.35); border-radius: 999px;
      font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase;
    }
    h1 {
      font-family: "Instrument Serif", Georgia, serif;
      font-size: clamp(2.8rem, 7vw, 5rem); line-height: 0.98; margin: 0 0 1rem;
      letter-spacing: -0.03em;
    }
    .lede { margin: 0 0 1.4rem; font-size: 1.1rem; color: rgba(255,253,248,0.88); max-width: 34rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 0.65rem; padding: 0.9rem 1.2rem; text-decoration: none;
      font-weight: 700; border: 0; cursor: pointer; font: inherit;
      transition: transform 160ms ease, background 160ms ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary { background: var(--pine); color: #fff; }
    .btn-primary:hover { background: var(--pine-deep); }
    .btn-secondary { background: rgba(255,253,248,0.92); color: var(--ink); }
    section { padding: 3.25rem 0; }
    h2 {
      font-family: "Instrument Serif", Georgia, serif;
      font-size: clamp(1.9rem, 3vw, 2.5rem); margin: 0 0 0.6rem; letter-spacing: -0.02em;
    }
    .section-lede { color: var(--muted); max-width: 36rem; margin: 0 0 1.5rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
    .panel {
      background: var(--white); border: 1px solid var(--line); border-radius: 1rem; padding: 1.25rem;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .panel:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(18,23,31,0.08); }
    .panel h3 { margin: 0 0 0.45rem; font-size: 1.1rem; }
    .panel p { margin: 0; color: var(--muted); line-height: 1.5; }
    .split { display: grid; gap: 1.5rem; grid-template-columns: 1.1fr 0.9fr; align-items: center; }
    .gallery { display: grid; gap: 0.85rem; grid-template-columns: 1.2fr 0.8fr; }
    .gallery img { width: 100%; height: 100%; object-fit: cover; border-radius: 1rem; min-height: 180px; }
    .gallery .tall { grid-row: span 2; min-height: 380px; }
    label { display: block; font-size: 0.9rem; margin-bottom: 0.35rem; }
    input, textarea {
      width: 100%; border: 1px solid var(--line); border-radius: 0.55rem;
      padding: 0.75rem 0.85rem; font: inherit; margin-bottom: 0.85rem; background: #fff;
    }
    footer { padding: 2.5rem 0 3rem; color: var(--muted); border-top: 1px solid var(--line); }
    footer a { color: var(--pine); }
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 820px) {
      .split, .gallery { grid-template-columns: 1fr; }
      .gallery .tall { grid-row: auto; min-height: 240px; }
      .hero { min-height: 78svh; }
      h1 { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="site-header">
      <div class="brand">${escapeHtml(input.businessName)}</div>
      <nav aria-label="Primary">
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#area">Area</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>

    <main>
      <section class="hero" aria-label="Homepage hero">
        <div class="hero-media">
          <img src="${escapeHtml(pack.heroImage)}" alt="${escapeHtml(pack.heroAlt)}" width="1600" height="1000" fetchpriority="high">
        </div>
        <div class="hero-copy">
          <p class="badge">${escapeHtml(input.municipality)}, Connecticut</p>
          <h1>${escapeHtml(input.businessName)}</h1>
          <p class="lede">${escapeHtml(pack.lede)}</p>
          <div class="actions">
            <a class="btn btn-primary" href="${escapeHtml(phoneHref)}">${phone ? `Call ${escapeHtml(phoneDisplay)}` : escapeHtml(pack.cta)}</a>
            <a class="btn btn-secondary" href="#contact">${escapeHtml(pack.formTitle)}</a>
          </div>
        </div>
      </section>

      <section id="services">
        <h2>What we offer</h2>
        <p class="section-lede">Built for people in ${escapeHtml(input.municipality)} and the ${escapeHtml(input.planningRegion)} who want clear next steps — not a maze of pages.</p>
        <div class="grid">
          ${pack.services
            .map(
              (item) =>
                `<article class="panel"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`,
            )
            .join("\n          ")}
        </div>
      </section>

      <section id="about">
        <div class="split">
          <div>
            <h2>About ${escapeHtml(input.businessName)}</h2>
            <p class="section-lede">${escapeHtml(pack.about)}</p>
            <div class="actions">
              <a class="btn btn-primary" href="#contact">${escapeHtml(pack.cta)}</a>
            </div>
          </div>
          <div class="gallery" aria-label="Studio gallery">
            <img class="tall" src="${escapeHtml(pack.gallery[0].src)}" alt="${escapeHtml(pack.gallery[0].alt)}" width="900" height="1200" loading="lazy">
            <img src="${escapeHtml(pack.gallery[1].src)}" alt="${escapeHtml(pack.gallery[1].alt)}" width="800" height="600" loading="lazy">
            <img src="${escapeHtml(pack.gallery[2].src)}" alt="${escapeHtml(pack.gallery[2].alt)}" width="800" height="600" loading="lazy">
          </div>
        </div>
      </section>

      <section id="area">
        <h2>Serving ${escapeHtml(input.municipality)} and nearby towns</h2>
        <div class="panel">
          <p>${escapeHtml(input.businessName)} is based around ${escapeHtml(input.municipality)}, CT in the ${escapeHtml(input.planningRegion)}. Whether you are local or a short drive away, you can call or send a message and get a clear reply.</p>
        </div>
      </section>

      <section id="contact">
        <h2>${escapeHtml(pack.formTitle)}</h2>
        <p class="section-lede">${escapeHtml(pack.formBlurb)}</p>
        <div class="panel">
          <form action="${escapeHtml(formAction)}" method="post" enctype="text/plain">
            <label for="name">Name</label>
            <input id="name" name="name" required autocomplete="name">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email">
            <label for="message">How can we help?</label>
            <textarea id="message" name="message" rows="4" required></textarea>
            <button class="btn btn-primary" type="submit">${escapeHtml(pack.cta)}</button>
          </form>
          ${
            phone
              ? `<p style="margin-top:1rem;color:var(--muted);font-size:.95rem;">Prefer to talk? <a href="${escapeHtml(phoneHref)}">${escapeHtml(phoneDisplay)}</a></p>`
              : `<p style="margin-top:1rem;color:var(--muted);font-size:.95rem;">Prefer to talk? Use the form and we will call you back.</p>`
          }
        </div>
      </section>
    </main>

    <footer>
      <p><strong>${escapeHtml(input.businessName)}</strong> · ${escapeHtml(input.municipality)}, CT</p>
      <p><a href="${escapeHtml(phoneHref)}">${escapeHtml(phoneDisplay)}</a> · <a href="#contact">Contact</a></p>
    </footer>
  </div>
</body>
</html>
`;

  return { html, brief };
}

function resolveIndustryPack(input: DraftSiteInput): IndustryPack {
  const haystack = `${input.businessName} ${input.industry}`.toLowerCase();
  if (/fitness|gym|train|boxing|yoga|crossfit|pilates|martial|studio/.test(haystack)) {
    return {
      kind: "fitness",
      headline: input.businessName,
      lede: `Personal training and strength coaching in ${input.municipality}. Show up ready to work — we will meet you where you are and push you forward.`,
      description: `${input.businessName} in ${input.municipality}, CT offers personal training and fitness coaching for the ${input.planningRegion}. Book a session or request a callback today.`,
      services: [
        {
          title: "Personal training",
          body: "One-on-one sessions built around your goals, schedule, and experience level.",
        },
        {
          title: "Strength & conditioning",
          body: "Progressive workouts that build power, mobility, and consistency without the fluff.",
        },
        {
          title: "Accountability coaching",
          body: "Clear plans, check-ins, and coaching so you keep showing up week after week.",
        },
      ],
      about: `${input.businessName} is a local training home for people in ${input.municipality} who want serious coaching without a corporate gym feel. We keep the path simple: assess, train, improve.`,
      heroImage:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} training floor in ${input.municipality}, Connecticut`,
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
          alt: "Athlete training with free weights",
        },
        {
          src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80",
          alt: "Coach guiding a training session",
        },
        {
          src: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80",
          alt: "Modern fitness equipment ready for members",
        },
      ],
      cta: "Book a session",
      formTitle: "Start training",
      formBlurb: "Tell us your goals and preferred times. We will follow up with next steps.",
      schemaType: "HealthClub",
    };
  }

  if (/plumb|electric|hvac|roof|landscap|lawn|clean|repair|contractor|handyman/.test(haystack)) {
    return {
      kind: "trades",
      headline: input.businessName,
      lede: `Reliable ${input.industry.toLowerCase()} for homes and businesses in ${input.municipality} and the ${input.planningRegion}.`,
      description: `${input.businessName} provides ${input.industry.toLowerCase()} in ${input.municipality}, CT. Request a quote online or call today.`,
      services: [
        { title: "On-site estimates", body: "Clear scope and pricing before work begins." },
        { title: "Quality workmanship", body: "Local crews who show up prepared and finish clean." },
        { title: "Fast response", body: "Call or message and get a real reply — not a black hole." },
      ],
      about: `${input.businessName} serves ${input.municipality} with straightforward service, honest communication, and work you can trust.`,
      heroImage:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} serving ${input.municipality}, Connecticut`,
      gallery: [
        {
          src: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80",
          alt: "Professional tools ready for a job",
        },
        {
          src: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
          alt: "Technician completing residential service",
        },
        {
          src: "https://images.unsplash.com/photo-1556911220-bff31c9870a0?auto=format&fit=crop&w=800&q=80",
          alt: "Finished home improvement detail",
        },
      ],
      cta: "Request a quote",
      formTitle: "Get a quote",
      formBlurb: "Share a few details about the job and we will get back to you.",
      schemaType: "HomeAndConstructionBusiness",
    };
  }

  return {
    kind: "local",
    headline: input.businessName,
    lede: `${input.industry} for neighbors in ${input.municipality} and across the ${input.planningRegion}. Clear contact, clear next steps.`,
    description: `${input.businessName} serves ${input.municipality} and the ${input.planningRegion} region with ${input.industry.toLowerCase()}. Request a quote online today.`,
    services: [
      { title: "Local expertise", body: `We know ${input.municipality} and nearby towns — and we show up for the people who live here.` },
      { title: "Straightforward process", body: "Tell us what you need, get a clear reply, and move forward without the runaround." },
      { title: "Easy to reach", body: "Call or send a message from any phone. Contact details stay visible, not buried." },
    ],
    about: `${input.businessName} is built for local customers who want a professional first impression online and a simple way to get in touch.`,
    heroImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
    heroAlt: `${input.businessName} serving ${input.municipality}, Connecticut`,
    gallery: [
      {
        src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
        alt: "Local team collaborating with a client",
      },
      {
        src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80",
        alt: "Professional consultation meeting",
      },
      {
        src: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80",
        alt: "Planning the next project on a laptop",
      },
    ],
    cta: "Request a quote",
    formTitle: "Contact us",
    formBlurb: "Send a short message and we will follow up with next steps.",
    schemaType: "LocalBusiness",
  };
}

function contactEmail(input: DraftSiteInput): string {
  try {
    const host = new URL(input.currentUrl).hostname.replace(/^www\./, "");
    if (host.includes(".")) return `hello@${host}`;
  } catch {
    // fall through
  }
  const slug =
    input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "business";
  return `hello@${slug}.com`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
