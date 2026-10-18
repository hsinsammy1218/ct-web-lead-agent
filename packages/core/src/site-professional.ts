import type { DraftSiteBrief, DraftSiteInput, DraftSiteFile, DraftSiteResult } from "./site-draft.js";
import { extractSiteContent, siteModeFromHost, type ExtractedSite } from "./site-extract.js";

export interface ProfessionalSiteResult extends DraftSiteResult {
  files: DraftSiteFile[];
  mode: "update" | "new";
}

interface SiteModel {
  mode: "update" | "new";
  name: string;
  municipality: string;
  region: string;
  industry: string;
  tagline: string;
  description: string;
  lede: string;
  about: string[];
  services: Array<{ title: string; body: string }>;
  hero: { src: string; alt: string };
  gallery: Array<{ src: string; alt: string }>;
  phone: string | null;
  email: string | null;
  socials: Array<{ label: string; href: string }>;
  cta: string;
  schemaType: string;
}

/**
 * Default post-audit deliverable: a complete multi-page professional site.
 * - update: rebuild from the business’s live site content/media when available
 * - new: build a new official site from lead + industry context
 */
export function buildProfessionalSite(
  input: DraftSiteInput & { sourceHtml?: string | null },
): ProfessionalSiteResult {
  const mode = siteModeFromHost(input.hostClass, input.score?.recommendedService ?? input.ai?.recommended_service);
  const extracted =
    mode === "update" && input.sourceHtml
      ? extractSiteContent(input.sourceHtml, input.currentUrl)
      : null;
  const model = buildModel(input, mode, extracted);
  const generatedAt = new Date().toISOString();
  const service = input.score?.recommendedService ?? input.ai?.recommended_service ?? (mode === "new" ? "new_site" : "redesign");

  const brief: DraftSiteBrief = {
    leadId: input.leadId,
    businessName: model.name,
    generatedAt,
    recommendedService: service,
    opportunity: input.score?.opportunity ?? null,
    band: input.score?.band ?? null,
    currentUrl: input.currentUrl,
    fixesApplied: [
      mode === "update"
        ? "Rebuilt as a full multi-page professional site from the live business content."
        : "Built a new multi-page professional website to replace a missing or non-official web presence.",
      "Published dedicated Home, Services, About, and Contact pages.",
      ...(extracted?.images.length
        ? ["Used photography and media discovered on the current website."]
        : ["Included clear local imagery and conversion-focused contact paths."]),
      "Added local SEO title, meta description, and LocalBusiness schema.",
      "Added clear navigation, click-to-call/contact paths, and a contact form.",
    ],
    findingsAddressed: [...new Set(input.findings.map((f) => f.code))],
    summary:
      mode === "update"
        ? `Final professional website update for ${model.name} in ${model.municipality}, CT — rebuilt from the current site’s content and branding.`
        : `Final new professional website for ${model.name} in ${model.municipality}, CT — ready to replace a weak or missing official site.`,
  };

  const css = professionalCss();
  const files: DraftSiteFile[] = [
    { path: "styles.css", content: css },
    { path: "index.html", content: pageHome(model) },
    { path: "services.html", content: pageServices(model) },
    { path: "about.html", content: pageAbout(model) },
    { path: "contact.html", content: pageContact(model) },
  ];

  return {
    html: files[1]!.content,
    brief,
    files,
    mode,
  };
}

function buildModel(
  input: DraftSiteInput,
  mode: "update" | "new",
  extracted: ExtractedSite | null,
): SiteModel {
  const pack = industryDefaults(input);
  const name = input.businessName;
  const phone = input.phone ?? extracted?.phones[0] ?? null;
  const email = extracted?.emails[0] ?? guessEmail(input);
  const description =
    extracted?.description ??
    `${name} in ${input.municipality}, CT offers ${input.industry.toLowerCase()} for the ${input.planningRegion}.`;
  const lede =
    extracted?.paragraphs[0] ??
    pack.lede;
  const about = (extracted?.paragraphs.slice(0, 4).length ? extracted.paragraphs.slice(0, 4) : [pack.about]).filter(Boolean);
  const services = servicesFromExtracted(extracted, pack.services);
  const images = extracted?.images ?? [];
  const hero = images[0] ?? { src: pack.heroImage, alt: pack.heroAlt };
  const gallery =
    images.slice(1, 4).length >= 1
      ? images.slice(1, 4)
      : pack.gallery;
  const tagline =
    extracted?.headings.find((h) => !sameName(h, name) && h.length <= 48) ??
    `${input.industry} · ${input.municipality}, CT`;

  return {
    mode,
    name,
    municipality: input.municipality,
    region: input.planningRegion,
    industry: input.industry,
    tagline,
    description,
    lede,
    about,
    services,
    hero,
    gallery,
    phone,
    email,
    socials: extracted?.socialLinks ?? [],
    cta: pack.cta,
    schemaType: pack.schemaType,
  };
}

function servicesFromExtracted(
  extracted: ExtractedSite | null,
  fallback: Array<{ title: string; body: string }>,
): Array<{ title: string; body: string }> {
  if (!extracted) return fallback;
  const fromHeadings = extracted.headings
    .filter((h) => !/home|contact|about|menu|book|login|sign/i.test(h))
    .slice(0, 4)
    .map((title, index) => ({
      title,
      body: extracted.paragraphs[index + 1] ?? extracted.paragraphs[0] ?? "Learn more and get in touch for details.",
    }));
  return fromHeadings.length >= 2 ? fromHeadings : fallback;
}

function industryDefaults(input: DraftSiteInput) {
  const hay = `${input.businessName} ${input.industry}`.toLowerCase();
  if (/fitness|gym|train|boxing|yoga|crossfit|pilates|martial|studio/.test(hay)) {
    return {
      lede: `Training and coaching in ${input.municipality} for every level — clear programs, real coaching, and a place you will want to come back to.`,
      about: `${input.businessName} is a local training home in ${input.municipality}. Members come for boxing, fitness, and coaching that meets them where they are.`,
      services: [
        { title: "Classes & coaching", body: "Group classes and guided sessions built for progress, not guesswork." },
        { title: "Private training", body: "One-on-one work for technique, conditioning, and accountability." },
        { title: "Youth & adults", body: "Programs that welcome beginners and challenge experienced athletes." },
      ],
      heroImage: "https://images.unsplash.com/photo-1549719386-91eedb5da0bd?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} training space in ${input.municipality}, Connecticut`,
      gallery: [
        { src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80", alt: "Strength training on the floor" },
        { src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80", alt: "Coach working with an athlete" },
        { src: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80", alt: "Ready equipment in the gym" },
      ],
      cta: "Book a class",
      schemaType: "HealthClub",
    };
  }
  if (/plumb|electric|hvac|roof|landscap|lawn|clean|repair|contractor|handyman/.test(hay)) {
    return {
      lede: `Reliable ${input.industry.toLowerCase()} for homes and businesses in ${input.municipality} and the ${input.planningRegion}.`,
      about: `${input.businessName} serves ${input.municipality} with clear estimates, prepared crews, and work you can trust.`,
      services: [
        { title: "On-site estimates", body: "Clear scope and pricing before work begins." },
        { title: "Quality workmanship", body: "Local crews who show up prepared and finish clean." },
        { title: "Fast response", body: "Call or message and get a real reply." },
      ],
      heroImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} serving ${input.municipality}, Connecticut`,
      gallery: [
        { src: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", alt: "Professional tools ready for a job" },
        { src: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80", alt: "Technician completing residential service" },
        { src: "https://images.unsplash.com/photo-1556911220-bff31c9870a0?auto=format&fit=crop&w=800&q=80", alt: "Finished home improvement detail" },
      ],
      cta: "Request a quote",
      schemaType: "HomeAndConstructionBusiness",
    };
  }
  return {
    lede: `${input.industry} for neighbors in ${input.municipality} and across the ${input.planningRegion}. Clear contact, clear next steps.`,
    about: `${input.businessName} is built for local customers who want a professional first impression online and a simple way to get in touch.`,
    services: [
      { title: "Local expertise", body: `We know ${input.municipality} and nearby towns — and we show up for the people who live here.` },
      { title: "Straightforward process", body: "Tell us what you need, get a clear reply, and move forward." },
      { title: "Easy to reach", body: "Call or send a message from any phone. Contact details stay visible." },
    ],
    heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
    heroAlt: `${input.businessName} serving ${input.municipality}, Connecticut`,
    gallery: [
      { src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80", alt: "Local team collaborating with a client" },
      { src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80", alt: "Professional consultation meeting" },
      { src: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80", alt: "Planning the next project" },
    ],
    cta: "Get in touch",
    schemaType: "LocalBusiness",
  };
}

function pageHome(model: SiteModel): string {
  const phoneHref = model.phone ? `tel:${model.phone.replace(/[^\d+]/g, "")}` : "contact.html";
  return shell(model, "home", "Home", model.description, `
  <section class="hero">
    <div class="hero-media">
      <img src="${esc(model.hero.src)}" alt="${esc(model.hero.alt)}" width="1600" height="1100" fetchpriority="high">
    </div>
    <div class="hero-copy wrap">
      <p class="eyebrow">${esc(model.municipality)}, Connecticut</p>
      <h1>${esc(model.name)}</h1>
      <p class="tagline">${esc(model.tagline)}</p>
      <p class="lede">${esc(model.lede)}</p>
      <div class="actions">
        <a class="btn btn-primary" href="${esc(phoneHref)}">${model.phone ? `Call ${esc(model.phone)}` : esc(model.cta)}</a>
        <a class="btn btn-ghost" href="services.html">View services</a>
      </div>
    </div>
  </section>

  <section class="wrap pillars">
    ${model.services
      .slice(0, 3)
      .map((s) => `<article><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></article>`)
      .join("\n    ")}
  </section>

  <section class="band">
    <div class="wrap split">
      <div>
        <p class="eyebrow">${model.mode === "update" ? "Updated for your customers" : "Built for your customers"}</p>
        <h2>Why ${esc(model.name)}</h2>
        <p>${esc(model.about[0] ?? model.lede)}</p>
        <a class="btn btn-primary" href="about.html">About the business</a>
      </div>
      <div class="stack-photos">
        ${model.gallery
          .slice(0, 2)
          .map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt)}" width="900" height="1200" loading="lazy">`)
          .join("\n        ")}
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div class="wrap">
      <h2>Ready to get started?</h2>
      <p>${esc(model.municipality)}, CT · ${esc(model.region)}${model.email ? ` · <a href="mailto:${esc(model.email)}">${esc(model.email)}</a>` : ""}</p>
      <a class="btn btn-primary" href="contact.html">${esc(model.cta)}</a>
    </div>
  </section>`);
}

function pageServices(model: SiteModel): string {
  return shell(model, "services", "Services", `${model.name} services in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">What we offer</p>
    <h1>Services</h1>
    <p class="lede">${esc(model.lede)}</p>
  </section>
  <section class="wrap service-list">
    ${model.services
      .map(
        (s) => `<article>
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.body)}</p>
    </article>`,
      )
      .join("\n    ")}
  </section>
  <section class="cta-band">
    <div class="wrap">
      <h2>Have a project or question?</h2>
      <a class="btn btn-primary" href="contact.html">${esc(model.cta)}</a>
    </div>
  </section>`);
}

function pageAbout(model: SiteModel): string {
  return shell(model, "about", "About", `About ${model.name} in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">Our story</p>
    <h1>About ${esc(model.name)}</h1>
  </section>
  <section class="wrap split about-grid">
    <div class="prose">
      ${model.about.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      <p>Serving ${esc(model.municipality)} and the ${esc(model.region)}.</p>
    </div>
    <div class="stack-photos">
      ${[model.hero, ...model.gallery]
        .slice(0, 3)
        .map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt)}" width="900" height="1100" loading="lazy">`)
        .join("\n      ")}
    </div>
  </section>`);
}

function pageContact(model: SiteModel): string {
  const phoneHref = model.phone ? `tel:${model.phone.replace(/[^\d+]/g, "")}` : "#";
  const subject = encodeURIComponent(`Website inquiry — ${model.name}`);
  const formAction = `mailto:${model.email ?? "hello@example.com"}?subject=${subject}`;
  return shell(model, "contact", "Contact", `Contact ${model.name} in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">Get in touch</p>
    <h1>Contact</h1>
    <p class="lede">Call, email, or send a short message. We will follow up with clear next steps.</p>
  </section>
  <section class="wrap contact-grid">
    <div class="contact-card">
      <h2>Reach us</h2>
      <ul>
        <li>${esc(model.municipality)}, CT</li>
        ${model.phone ? `<li><a href="${esc(phoneHref)}">${esc(model.phone)}</a></li>` : ""}
        ${model.email ? `<li><a href="mailto:${esc(model.email)}">${esc(model.email)}</a></li>` : ""}
      </ul>
      ${
        model.socials.length
          ? `<p class="social-inline">${model.socials
              .map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noreferrer">${esc(s.label)}</a>`)
              .join(" · ")}</p>`
          : ""
      }
    </div>
    <div class="contact-card">
      <h2>${esc(model.cta)}</h2>
      <form action="${esc(formAction)}" method="post" enctype="text/plain">
        <label for="name">Name</label>
        <input id="name" name="name" required autocomplete="name">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" type="tel" autocomplete="tel">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email">
        <label for="message">How can we help?</label>
        <textarea id="message" name="message" rows="4" required></textarea>
        <button class="btn btn-primary" type="submit">Send message</button>
      </form>
    </div>
  </section>`);
}

function shell(model: SiteModel, active: string, pageLabel: string, description: string, main: string): string {
  const title =
    active === "home"
      ? `${model.name} | ${model.municipality}, CT`
      : `${pageLabel} | ${model.name}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": model.schemaType === "LocalBusiness" ? "LocalBusiness" : ["LocalBusiness", model.schemaType],
    name: model.name,
    url: "index.html",
    telephone: model.phone ?? undefined,
    email: model.email ?? undefined,
    image: model.hero.src,
    description: model.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: model.municipality,
      addressRegion: "CT",
      addressCountry: "US",
    },
    areaServed: [`${model.municipality}, CT`, model.region],
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(model.hero.src)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="index.html">
      <strong>${esc(model.name)}</strong>
      <small>${esc(model.municipality)}, CT</small>
    </a>
    <button class="nav-toggle" type="button" aria-label="Open menu" onclick="document.body.classList.toggle('nav-open')">Menu</button>
    <nav aria-label="Primary">
      <a href="index.html" class="${active === "home" ? "active" : ""}">Home</a>
      <a href="services.html" class="${active === "services" ? "active" : ""}">Services</a>
      <a href="about.html" class="${active === "about" ? "active" : ""}">About</a>
      <a class="btn btn-nav" href="contact.html">Contact</a>
    </nav>
  </header>
  <main>
${main}
  </main>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <h2>${esc(model.name)}</h2>
        <p>${esc(model.tagline)}</p>
      </div>
      <div>
        <h3>Visit</h3>
        <p>${esc(model.municipality)}, CT<br>${esc(model.region)}</p>
        ${model.phone ? `<p><a href="tel:${esc(model.phone.replace(/[^\d+]/g, ""))}">${esc(model.phone)}</a></p>` : ""}
        ${model.email ? `<p><a href="mailto:${esc(model.email)}">${esc(model.email)}</a></p>` : ""}
      </div>
      <div>
        <h3>Explore</h3>
        <ul>
          <li><a href="services.html">Services</a></li>
          <li><a href="about.html">About</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
    </div>
    <p class="fine">© ${new Date().getFullYear()} ${esc(model.name)} · ${esc(model.municipality)}, Connecticut</p>
  </footer>
</body>
</html>`;
}

function professionalCss(): string {
  return `:root {
  --bg: #0c1220;
  --bg-2: #121a2b;
  --panel: #172235;
  --text: #f3f6fb;
  --muted: #a7b3c7;
  --line: #2a3850;
  --accent: #3dd6c6;
  --accent-deep: #2bb3a5;
  --max: 1100px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: Outfit, system-ui, sans-serif;
  background:
    radial-gradient(900px 420px at 12% -8%, rgba(61,214,198,0.16), transparent 55%),
    radial-gradient(700px 380px at 90% 8%, rgba(80,120,255,0.12), transparent 50%),
    var(--bg);
  color: var(--text);
  line-height: 1.55;
}
a { color: inherit; }
img { display: block; max-width: 100%; }
.wrap { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto; }
.site-header {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.85rem max(1rem, calc((100% - var(--max)) / 2));
  background: rgba(12,18,32,0.92); border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px);
}
.brand { text-decoration: none; }
.brand strong { display: block; font-size: 1.05rem; letter-spacing: 0.01em; }
.brand small { color: var(--muted); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
.site-header nav { display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: center; }
.site-header nav a { text-decoration: none; color: var(--muted); font-size: 0.9rem; font-weight: 600; }
.site-header nav a:hover, .site-header nav a.active { color: var(--accent); }
.nav-toggle { display: none; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 0.4rem; padding: 0.55rem 0.8rem; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.15rem; border-radius: 0.45rem; text-decoration: none;
  font-weight: 700; border: 0; cursor: pointer; font: inherit;
}
.btn-primary { background: var(--accent); color: #06201d; }
.btn-primary:hover { background: var(--accent-deep); color: #fff; }
.btn-ghost { border: 1px solid rgba(255,255,255,0.35); color: #fff; background: transparent; }
.btn-nav { background: var(--accent); color: #06201d !important; padding: 0.5rem 0.85rem; border-radius: 0.35rem; }
.hero { position: relative; min-height: 72svh; display: grid; align-items: end; }
.hero-media { position: absolute; inset: 0; }
.hero-media img { width: 100%; height: 100%; object-fit: cover; }
.hero-media::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(8,12,22,0.92) 0%, rgba(8,12,22,0.55) 55%, rgba(8,12,22,0.25) 100%),
    linear-gradient(180deg, rgba(8,12,22,0.2), rgba(8,12,22,0.85));
}
.hero-copy { position: relative; z-index: 1; padding: 3rem 0 2.25rem; }
.hero-copy > * { max-width: 36rem; }
.eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.78rem; font-weight: 700; margin: 0 0 0.6rem; }
h1, h2, h3 { font-family: Fraunces, Georgia, serif; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 0.6rem; }
h1 { font-size: clamp(2.6rem, 6vw, 4.4rem); }
h2 { font-size: clamp(1.8rem, 3.5vw, 2.6rem); }
.tagline { margin: 0 0 0.75rem; font-size: 1.15rem; color: #e8eef8; font-weight: 600; }
.lede { color: var(--muted); margin: 0 0 1.2rem; font-size: 1.05rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
.pillars { display: grid; gap: 0.9rem; grid-template-columns: repeat(3, 1fr); padding: 2.25rem 0; }
.pillars article { background: color-mix(in srgb, var(--panel) 88%, transparent); border: 1px solid var(--line); padding: 1.2rem; border-radius: 0.6rem; }
.pillars p { margin: 0; color: var(--muted); }
.band { background: var(--bg-2); padding: 2.75rem 0; border-block: 1px solid var(--line); }
.split { display: grid; gap: 1.75rem; grid-template-columns: 1.1fr 0.9fr; align-items: start; }
.stack-photos { display: grid; gap: 0.75rem; grid-template-columns: 1fr 1fr; }
.stack-photos img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 0.55rem; }
.cta-band { padding: 3rem 0; text-align: center; }
.cta-band .wrap { display: grid; gap: 0.85rem; justify-items: center; }
.page-hero { padding: 2.75rem 0 1.25rem; }
.service-list { display: grid; gap: 1rem; padding-bottom: 2.5rem; }
.service-list article { background: var(--panel); border: 1px solid var(--line); border-radius: 0.6rem; padding: 1.25rem; }
.about-grid { padding-bottom: 3rem; }
.prose p { color: var(--muted); margin: 0 0 1rem; }
.contact-grid { display: grid; gap: 1rem; grid-template-columns: 0.9fr 1.1fr; padding-bottom: 3rem; }
.contact-card { background: var(--panel); border: 1px solid var(--line); border-radius: 0.65rem; padding: 1.25rem; }
.contact-card ul { margin: 0; padding-left: 1.1rem; color: var(--muted); }
.contact-card label { display: block; font-size: 0.9rem; margin-bottom: 0.3rem; }
.contact-card input, .contact-card textarea {
  width: 100%; border: 1px solid var(--line); border-radius: 0.45rem;
  padding: 0.7rem 0.8rem; margin-bottom: 0.8rem; background: #0f1726; color: var(--text); font: inherit;
}
.social-inline { color: var(--muted); }
.social-inline a { color: var(--accent); }
.site-footer { border-top: 1px solid var(--line); padding: 2.25rem 0 1.5rem; background: #090e18; }
.footer-grid { display: grid; gap: 1.25rem; grid-template-columns: 1.3fr 1fr 1fr; }
.footer-grid h2, .footer-grid h3 { margin-bottom: 0.4rem; }
.footer-grid p, .footer-grid li { color: var(--muted); }
.footer-grid ul { list-style: none; margin: 0; padding: 0; }
.footer-grid a { text-decoration: none; }
.fine { width: min(var(--max), calc(100% - 2rem)); margin: 1.5rem auto 0; color: var(--muted); font-size: 0.85rem; }
@media (max-width: 860px) {
  .pillars, .split, .contact-grid, .footer-grid, .stack-photos { grid-template-columns: 1fr; }
  .nav-toggle { display: inline-flex; }
  .site-header nav { display: none; }
  body.nav-open .site-header nav { display: flex; position: absolute; inset: 100% 0 auto 0; background: var(--bg); padding: 1rem; border-bottom: 1px solid var(--line); flex-direction: column; align-items: flex-start; }
  .hero { min-height: 68svh; }
}
`;
}

function guessEmail(input: DraftSiteInput): string | null {
  try {
    const host = new URL(input.currentUrl).hostname.replace(/^www\./, "");
    if (host.includes(".") && !/facebook|instagram|yelp|bbb\.org|mapquest/i.test(host)) {
      return `hello@${host}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function sameName(a: string, b: string): boolean {
  return a.replace(/\W+/g, "").toLowerCase() === b.replace(/\W+/g, "").toLowerCase();
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
