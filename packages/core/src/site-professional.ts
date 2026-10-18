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
  programs: Array<{ title: string; body: string }>;
  hero: { src: string; alt: string };
  gallery: Array<{ src: string; alt: string }>;
  phone: string | null;
  email: string | null;
  socials: Array<{ label: string; href: string }>;
  cta: string;
}

/**
 * Fitness-vertical post-audit deliverable: multi-page gym / studio / boxing site.
 * - update: rebuild from the business’s live site content/media when available
 * - new: build a new official fitness site from lead + fitness defaults
 */
export function buildProfessionalSite(
  input: DraftSiteInput & { sourceHtml?: string | null },
): ProfessionalSiteResult {
  const mode = siteModeFromHost(input.hostClass, input.score?.recommendedService ?? input.ai?.recommended_service);
  const extracted =
    mode === "update" && input.sourceHtml
      ? extractSiteContent(input.sourceHtml, input.currentUrl)
      : null;
  const model = buildFitnessModel(input, mode, extracted);
  const generatedAt = new Date().toISOString();
  const service =
    input.score?.recommendedService ?? input.ai?.recommended_service ?? (mode === "new" ? "new_site" : "redesign");

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
        ? "Rebuilt as a full multi-page fitness website from the live gym content."
        : "Built a new multi-page fitness website to replace a missing or non-official web presence.",
      "Published dedicated Home, Classes, About, and Book pages for a Connecticut fitness business.",
      ...(extracted?.images.length
        ? ["Used photography and media discovered on the current website."]
        : ["Included training-floor imagery and clear booking / contact paths."]),
      "Added local SEO title, meta description, and HealthClub / LocalBusiness schema.",
      "Added navigation, click-to-call, and a class inquiry / booking form.",
    ],
    findingsAddressed: [...new Set(input.findings.map((f) => f.code))],
    summary:
      mode === "update"
        ? `Final fitness website update for ${model.name} in ${model.municipality}, CT — rebuilt from the current site’s content and branding.`
        : `Final new fitness website for ${model.name} in ${model.municipality}, CT — ready to replace a weak or missing official site.`,
  };

  const files: DraftSiteFile[] = [
    { path: "styles.css", content: fitnessCss() },
    { path: "index.html", content: pageHome(model) },
    { path: "classes.html", content: pageClasses(model) },
    { path: "about.html", content: pageAbout(model) },
    { path: "book.html", content: pageBook(model) },
  ];

  return {
    html: files[1]!.content,
    brief,
    files,
    mode,
  };
}

function buildFitnessModel(
  input: DraftSiteInput,
  mode: "update" | "new",
  extracted: ExtractedSite | null,
): SiteModel {
  const pack = fitnessDefaults(input);
  const name = input.businessName;
  const phone = input.phone ?? extracted?.phones[0] ?? null;
  const email = extracted?.emails[0] ?? guessEmail(input);
  const description =
    extracted?.description ??
    `${name} in ${input.municipality}, CT — ${input.industry.toLowerCase()} for the ${input.planningRegion}. Classes, coaching, and training for every level.`;
  const lede = extracted?.paragraphs[0] ?? pack.lede;
  const about = (extracted?.paragraphs.slice(0, 4).length ? extracted.paragraphs.slice(0, 4) : [pack.about]).filter(
    Boolean,
  );
  const programs = programsFromExtracted(extracted, pack.programs);
  const images = extracted?.images ?? [];
  const hero = images[0] ?? { src: pack.heroImage, alt: pack.heroAlt };
  const gallery = images.slice(1, 4).length >= 1 ? images.slice(1, 4) : pack.gallery;
  const tagline =
    extracted?.headings.find((h) => !sameName(h, name) && h.length <= 48) ?? pack.tagline;

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
    programs,
    hero,
    gallery,
    phone,
    email,
    socials: extracted?.socialLinks ?? [],
    cta: pack.cta,
  };
}

function programsFromExtracted(
  extracted: ExtractedSite | null,
  fallback: Array<{ title: string; body: string }>,
): Array<{ title: string; body: string }> {
  if (!extracted) return fallback;
  const fromHeadings = extracted.headings
    .filter((h) => !/home|contact|about|menu|book|login|sign|hours/i.test(h))
    .slice(0, 4)
    .map((title, index) => ({
      title,
      body:
        extracted.paragraphs[index + 1] ??
        extracted.paragraphs[0] ??
        "Train with coaching that meets you where you are — book a class to get started.",
    }));
  return fromHeadings.length >= 2 ? fromHeadings : fallback;
}

function fitnessDefaults(input: DraftSiteInput) {
  const hay = `${input.businessName} ${input.industry}`.toLowerCase();
  const boxing = /box|mma|martial|kickbox|muay/.test(hay);
  const yoga = /yoga|pilates|barre/.test(hay);
  const crossfit = /crossfit|functional|hiit|boot ?camp/.test(hay);

  if (boxing) {
    return {
      tagline: `Boxing · Fitness · ${input.municipality}, CT`,
      lede: `Real boxing skills and conditioning in ${input.municipality}. Train with coaches who push you forward — whether you are new to the bag or sharpening for fight night.`,
      about: `${input.businessName} is a boxing and fitness home in ${input.municipality}. Members come for mitts, bags, sparring, and strength work in a gym that feels like family.`,
      programs: [
        { title: "Boxing classes", body: "Technique, footwork, and conditioning for adults, teens, and youth." },
        { title: "Private coaching", body: "One-on-one mitt work and fight prep tailored to your goals." },
        { title: "Fitness & bags", body: "High-energy bag work and bootcamps that build power and cardio." },
      ],
      heroImage: "https://images.unsplash.com/photo-1549719386-91eedb5da0bd?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} boxing floor in ${input.municipality}, Connecticut`,
      gallery: [
        { src: "https://images.unsplash.com/photo-1517438322297-f04183b6f3d3?auto=format&fit=crop&w=900&q=80", alt: "Boxer working the heavy bag" },
        { src: "https://images.unsplash.com/photo-1599058945522-28d584b6f14f?auto=format&fit=crop&w=800&q=80", alt: "Coach holding mitts" },
        { src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80", alt: "Strength training beside the ring" },
      ],
      cta: "Book a class",
    };
  }

  if (yoga) {
    return {
      tagline: `Yoga · Movement · ${input.municipality}, CT`,
      lede: `Grounded classes in ${input.municipality} for strength, mobility, and calm — welcoming to beginners and steady practitioners alike.`,
      about: `${input.businessName} is a movement studio in ${input.municipality} focused on breath, alignment, and community.`,
      programs: [
        { title: "Group classes", body: "Flow, foundations, and restorative sessions on the weekly schedule." },
        { title: "Private sessions", body: "One-on-one coaching for form, recovery, and personal goals." },
        { title: "Workshops", body: "Deeper practice days for mobility, breathwork, and strength." },
      ],
      heroImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} studio in ${input.municipality}, Connecticut`,
      gallery: [
        { src: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80", alt: "Yoga class in session" },
        { src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80", alt: "Quiet studio floor" },
        { src: "https://images.unsplash.com/photo-1575052814086-f38513c0c0a3?auto=format&fit=crop&w=800&q=80", alt: "Instructor guiding alignment" },
      ],
      cta: "Book a class",
    };
  }

  if (crossfit) {
    return {
      tagline: `Strength · Conditioning · ${input.municipality}, CT`,
      lede: `High-intensity training in ${input.municipality} with coaching that scales to your level — show up, work hard, leave stronger.`,
      about: `${input.businessName} is a training community in ${input.municipality} built on functional fitness, accountability, and results.`,
      programs: [
        { title: "Group WODs", body: "Daily workouts coached for beginners through competitors." },
        { title: "Personal training", body: "Focused sessions for form, strength, and programming." },
        { title: "Foundations", body: "On-ramps that teach movement standards before intensity." },
      ],
      heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
      heroAlt: `${input.businessName} training floor in ${input.municipality}, Connecticut`,
      gallery: [
        { src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80", alt: "Athletes lifting together" },
        { src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80", alt: "Coach cueing a lift" },
        { src: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80", alt: "Open gym equipment ready" },
      ],
      cta: "Book a class",
    };
  }

  return {
    tagline: `Fitness · Coaching · ${input.municipality}, CT`,
    lede: `Training and coaching in ${input.municipality} for every level — clear programs, real coaching, and a gym you will want to come back to.`,
    about: `${input.businessName} is a local fitness home in ${input.municipality}. Members come for classes, personal training, and coaching that meets them where they are.`,
    programs: [
      { title: "Group classes", body: "Guided sessions built for progress, energy, and consistency." },
      { title: "Personal training", body: "One-on-one coaching for technique, conditioning, and goals." },
      { title: "Youth & adults", body: "Programs that welcome beginners and challenge experienced athletes." },
    ],
    heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80",
    heroAlt: `${input.businessName} gym in ${input.municipality}, Connecticut`,
    gallery: [
      { src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80", alt: "Strength training on the floor" },
      { src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80", alt: "Coach working with a member" },
      { src: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80", alt: "Ready equipment in the gym" },
    ],
    cta: "Book a class",
  };
}

function pageHome(model: SiteModel): string {
  const phoneHref = model.phone ? `tel:${model.phone.replace(/[^\d+]/g, "")}` : "book.html";
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
        <a class="btn btn-primary" href="book.html">${esc(model.cta)}</a>
        <a class="btn btn-ghost" href="classes.html">View classes</a>
      </div>
    </div>
  </section>

  <section class="wrap pillars">
    ${model.programs
      .slice(0, 3)
      .map((s) => `<article><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></article>`)
      .join("\n    ")}
  </section>

  <section class="band">
    <div class="wrap split">
      <div>
        <p class="eyebrow">${model.mode === "update" ? "Your gym, rebuilt" : "Built for members"}</p>
        <h2>Train at ${esc(model.name)}</h2>
        <p>${esc(model.about[0] ?? model.lede)}</p>
        <a class="btn btn-primary" href="about.html">Meet the gym</a>
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
      <h2>Ready to step on the floor?</h2>
      <p>${esc(model.municipality)}, CT · ${esc(model.region)}${model.phone ? ` · <a href="${esc(phoneHref)}">${esc(model.phone)}</a>` : ""}${model.email ? ` · <a href="mailto:${esc(model.email)}">${esc(model.email)}</a>` : ""}</p>
      <a class="btn btn-primary" href="book.html">${esc(model.cta)}</a>
    </div>
  </section>`);
}

function pageClasses(model: SiteModel): string {
  return shell(model, "classes", "Classes", `Classes and training at ${model.name} in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">On the floor</p>
    <h1>Classes &amp; programs</h1>
    <p class="lede">${esc(model.lede)}</p>
  </section>
  <section class="wrap service-list">
    ${model.programs
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
      <h2>Find a time that works</h2>
      <a class="btn btn-primary" href="book.html">${esc(model.cta)}</a>
    </div>
  </section>`);
}

function pageAbout(model: SiteModel): string {
  return shell(model, "about", "About", `About ${model.name} in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">Our gym</p>
    <h1>About ${esc(model.name)}</h1>
  </section>
  <section class="wrap split about-grid">
    <div class="prose">
      ${model.about.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      <p>Serving members in ${esc(model.municipality)} and the ${esc(model.region)}.</p>
    </div>
    <div class="stack-photos">
      ${[model.hero, ...model.gallery]
        .slice(0, 3)
        .map((img) => `<img src="${esc(img.src)}" alt="${esc(img.alt)}" width="900" height="1100" loading="lazy">`)
        .join("\n      ")}
    </div>
  </section>`);
}

function pageBook(model: SiteModel): string {
  const phoneHref = model.phone ? `tel:${model.phone.replace(/[^\d+]/g, "")}` : "#";
  const subject = encodeURIComponent(`Class inquiry — ${model.name}`);
  const formAction = `mailto:${model.email ?? "hello@example.com"}?subject=${subject}`;
  return shell(model, "book", "Book", `Book a class at ${model.name} in ${model.municipality}, CT.`, `
  <section class="page-hero wrap">
    <p class="eyebrow">Start training</p>
    <h1>Book a class</h1>
    <p class="lede">Call, email, or send a short message. Tell us your experience level and preferred times — we will follow up with next steps.</p>
  </section>
  <section class="wrap contact-grid">
    <div class="contact-card">
      <h2>Reach the gym</h2>
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
        <label for="message">Goals or class interest</label>
        <textarea id="message" name="message" rows="4" required></textarea>
        <button class="btn btn-primary" type="submit">Send inquiry</button>
      </form>
    </div>
  </section>`);
}

function shell(model: SiteModel, active: string, pageLabel: string, description: string, main: string): string {
  const title = active === "home" ? `${model.name} | ${model.municipality}, CT` : `${pageLabel} | ${model.name}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthClub", "SportsActivityLocation"],
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
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="index.html">
      <strong>${esc(model.name)}</strong>
      <small>${esc(model.municipality)}, CT · Fitness</small>
    </a>
    <button class="nav-toggle" type="button" aria-label="Open menu" onclick="document.body.classList.toggle('nav-open')">Menu</button>
    <nav aria-label="Primary">
      <a href="index.html" class="${active === "home" ? "active" : ""}">Home</a>
      <a href="classes.html" class="${active === "classes" ? "active" : ""}">Classes</a>
      <a href="about.html" class="${active === "about" ? "active" : ""}">About</a>
      <a class="btn btn-nav" href="book.html">Book Now</a>
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
        <h3>Train</h3>
        <ul>
          <li><a href="classes.html">Classes</a></li>
          <li><a href="about.html">About</a></li>
          <li><a href="book.html">Book a class</a></li>
        </ul>
      </div>
    </div>
    <p class="fine">© ${new Date().getFullYear()} ${esc(model.name)} · ${esc(model.municipality)}, Connecticut</p>
  </footer>
</body>
</html>`;
}

function fitnessCss(): string {
  return `:root {
  --bg: #070707;
  --bg-2: #111;
  --panel: #161616;
  --text: #f5f5f5;
  --muted: #b7b7b7;
  --line: #2a2a2a;
  --accent: #e10600;
  --accent-deep: #b00000;
  --max: 1120px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: Manrope, system-ui, sans-serif;
  background:
    radial-gradient(900px 420px at 10% -10%, rgba(225,6,0,0.18), transparent 55%),
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
  padding: 0.75rem max(1rem, calc((100% - var(--max)) / 2));
  background: rgba(7,7,7,0.94); border-bottom: 1px solid var(--line);
  backdrop-filter: blur(10px);
}
.brand { text-decoration: none; }
.brand strong { display: block; font-size: 1.02rem; letter-spacing: 0.02em; }
.brand small { color: var(--muted); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
.site-header nav { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; }
.site-header nav a { text-decoration: none; color: var(--muted); font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
.site-header nav a:hover, .site-header nav a.active { color: var(--accent); }
.nav-toggle { display: none; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 0.35rem; padding: 0.55rem 0.8rem; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.2rem; border-radius: 0.3rem; text-decoration: none;
  font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.85rem;
  border: 0; cursor: pointer; font: inherit;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-deep); }
.btn-ghost { border: 1px solid rgba(255,255,255,0.45); color: #fff; background: transparent; }
.btn-nav { background: var(--accent); color: #fff !important; padding: 0.55rem 0.9rem; border-radius: 0.3rem; }
.hero { position: relative; min-height: 70svh; display: grid; align-items: end; }
.hero-media { position: absolute; inset: 0; }
.hero-media img { width: 100%; height: 100%; object-fit: cover; object-position: center 35%; }
.hero-media::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.25) 100%),
    linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.82));
}
.hero-copy { position: relative; z-index: 1; padding: 2.75rem 0 2rem; }
.hero-copy > * { max-width: 36rem; }
.eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.78rem; font-weight: 800; margin: 0 0 0.55rem; }
h1, h2, h3 { font-family: "Bebas Neue", Impact, sans-serif; letter-spacing: 0.03em; line-height: 0.95; margin: 0 0 0.55rem; }
h1 { font-size: clamp(2.8rem, 7vw, 4.6rem); }
h2 { font-size: clamp(2rem, 4vw, 3rem); }
.tagline { font-family: "Bebas Neue", Impact, sans-serif; font-size: clamp(1.2rem, 3vw, 1.8rem); margin: 0 0 0.75rem; letter-spacing: 0.06em; }
.lede { color: var(--muted); margin: 0 0 1.15rem; font-size: 1.02rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
.pillars { display: grid; gap: 0.85rem; grid-template-columns: repeat(3, 1fr); padding: 2.1rem 0; }
.pillars article { background: var(--panel); border: 1px solid var(--line); padding: 1.15rem 1.2rem; }
.pillars h2 { color: var(--accent); }
.pillars p { margin: 0; color: var(--muted); }
.band { background: var(--bg-2); padding: 2.5rem 0; border-block: 1px solid var(--line); }
.split { display: grid; gap: 1.75rem; grid-template-columns: 1.1fr 0.9fr; align-items: start; }
.stack-photos { display: grid; gap: 0.75rem; grid-template-columns: 1fr 1fr; }
.stack-photos img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 0.35rem; }
.cta-band { padding: 3rem 0; text-align: center; }
.cta-band .wrap { display: grid; gap: 0.85rem; justify-items: center; }
.page-hero { padding: 2.75rem 0 1.25rem; }
.service-list { display: grid; gap: 1rem; padding-bottom: 2.5rem; }
.service-list article { background: var(--panel); border: 1px solid var(--line); padding: 1.25rem; }
.about-grid { padding-bottom: 3rem; }
.prose p { color: var(--muted); margin: 0 0 1rem; }
.contact-grid { display: grid; gap: 1rem; grid-template-columns: 0.9fr 1.1fr; padding-bottom: 3rem; }
.contact-card { background: var(--panel); border: 1px solid var(--line); padding: 1.25rem; }
.contact-card ul { margin: 0; padding-left: 1.1rem; color: var(--muted); }
.contact-card label { display: block; font-size: 0.9rem; margin-bottom: 0.3rem; }
.contact-card input, .contact-card textarea {
  width: 100%; border: 1px solid var(--line); border-radius: 0.35rem;
  padding: 0.7rem 0.8rem; margin-bottom: 0.8rem; background: #0d0d0d; color: var(--text); font: inherit;
}
.social-inline { color: var(--muted); }
.social-inline a { color: var(--accent); }
.site-footer { border-top: 1px solid var(--line); padding: 2.25rem 0 1.5rem; background: #050505; }
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
  body.nav-open .site-header nav {
    display: flex; position: absolute; inset: 100% 0 auto 0; background: var(--bg);
    padding: 1rem; border-bottom: 1px solid var(--line); flex-direction: column; align-items: flex-start;
  }
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
