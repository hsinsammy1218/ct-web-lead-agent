import type { DraftSiteBrief, DraftSiteInput, DraftSiteResult } from "./site-draft.js";

export interface SiteFile {
  path: string;
  content: string;
}

export interface SpecialtySiteResult extends DraftSiteResult {
  files: SiteFile[];
}

/** Detect when the audited site is In Your Corner Boxing / Fitness. */
export function isInYourCornerBoxing(input: DraftSiteInput, sourceHtml?: string | null): boolean {
  const hay = `${input.businessName} ${input.currentUrl} ${sourceHtml ?? ""}`.toLowerCase();
  return (
    hay.includes("inyourcorner") ||
    hay.includes("in your corner") ||
    (hay.includes("boxing") && hay.includes("wolcott"))
  );
}

/**
 * Full professional rebuild of In Your Corner Boxing using content and media
 * from https://www.inyourcornerfitness.com/
 *
 * Design cues drawn from top boxing sites (Gleason's, Mayweather Boxing + Fitness,
 * Rumble, Prime Boxing USA, Work Train Fight): full-bleed training photography,
 * condensed fight-poster type, address/hours utility bar, round-based IA,
 * and ring-rope / corner-post visual language.
 */
export function buildInYourCornerBoxingSite(input: DraftSiteInput): SpecialtySiteResult {
  const generatedAt = new Date().toISOString();
  const brief: DraftSiteBrief = {
    leadId: input.leadId,
    businessName: "In Your Corner Boxing",
    generatedAt,
    recommendedService: input.score?.recommendedService ?? input.ai?.recommended_service ?? "redesign",
    opportunity: input.score?.opportunity ?? null,
    band: input.score?.band ?? null,
    currentUrl: input.currentUrl,
    fixesApplied: [
      "Rebuilt as a full multi-page professional site from the live business content.",
      "Preserved brand identity: In Your Corner Boxing — Boxing, Fitness, Nutrition.",
      "Used the business’s own photography and logo from the current website.",
      "Shifted the first viewport to fight-gym patterns: action hero, condensed poster type, and ring cues.",
      "Added clear local SEO title, meta description, and LocalBusiness/SportsActivityLocation schema.",
      "Published dedicated pages for coaches, testimonials, Fight Back IYC, and booking/pricing.",
      "Surfaced real address, email, class schedule, and membership pricing from the source site.",
    ],
    findingsAddressed: [...new Set(input.findings.map((f) => f.code))],
    summary:
      "Final professional website for In Your Corner Boxing in Wolcott, CT — rebuilt from the current site’s content, branding, coaches, schedule, and pricing with a boxing-first presentation.",
  };

  const css = siteCss();
  const files: SiteFile[] = [
    { path: "styles.css", content: css },
    { path: "index.html", content: pageHome() },
    { path: "coaches.html", content: pageCoaches() },
    { path: "testimonials.html", content: pageTestimonials() },
    { path: "fight-back.html", content: pageFightBack() },
    { path: "book.html", content: pageBook() },
  ];

  return {
    html: files.find((f) => f.path === "index.html")!.content,
    brief,
    files,
  };
}

const IMG = {
  logo: "https://static.wixstatic.com/media/368ba1_c4f20561eee844f8a7b42eec282ec2a4~mv2.png/v1/fill/w_220,h_220,al_c,q_85,enc_auto/logo.png",
  building:
    "https://static.wixstatic.com/media/368ba1_d78b1d792627458ba2cf602309426c3f~mv2.jpg/v1/fill/w_1600,h_1100,al_c,q_85,enc_auto/building.jpg",
  community:
    "https://static.wixstatic.com/media/368ba1_eb92ae8b760f4608b0d22735391c136f~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/community.jpg",
  seniors:
    "https://static.wixstatic.com/media/368ba1_bdd74cfe9e96400389706dfaf6b8f00e~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/seniors.jpg",
  gear: "https://static.wixstatic.com/media/11062b_2746e0e5dec64a059a020a7d8d6636fa~mv2.jpg/v1/fill/w_1200,h_900,al_c,q_85,enc_auto/gear.jpg",
  training:
    "https://static.wixstatic.com/media/368ba1_05e4601e2f1c43ab87fd69ab39c6ff00~mv2.jpg/v1/fill/w_1200,h_900,al_c,q_85,enc_auto/training.jpg",
  // Official coach photos from https://www.inyourcornerfitness.com/team-1
  coachStephanie:
    "https://static.wixstatic.com/media/368ba1_ea5c20f65a7d4b30b72fcb849ddf9994~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/coach-steph.jpg",
  coachMya:
    "https://static.wixstatic.com/media/368ba1_3ed77e63cce74e608dc6f59a4bfdb98c~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/coach-mya.jpg",
  coachTyler:
    "https://static.wixstatic.com/media/368ba1_cab10733bf5a4f8aa5aac853ee308e6f~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/coach-tyler.jpg",
  coachCynthia:
    "https://static.wixstatic.com/media/368ba1_6f26cc7c9bcd40fcb683dcd0c62866b2~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/coach-cynthia.jpg",
  coachAmina:
    "https://static.wixstatic.com/media/368ba1_f7b40c30da604043825fc71e6c826ac6~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/coach-amina.jpg",
};

/** Social profiles linked from the live inyourcornerfitness.com site. */
const SOCIAL = [
  {
    network: "instagram" as const,
    label: "Instagram",
    handle: "@inyourcornerboxing",
    href: "https://www.instagram.com/inyourcornerboxing/",
  },
  {
    network: "instagram" as const,
    label: "Instagram",
    handle: "@box_like_a_mutha",
    href: "https://www.instagram.com/box_like_a_mutha/",
  },
  {
    network: "facebook" as const,
    label: "Facebook",
    handle: "IYC community",
    href: "https://www.facebook.com/groups/511510502872483",
  },
  {
    network: "youtube" as const,
    label: "YouTube",
    handle: "In Your Corner Boxing",
    href: "https://www.youtube.com/channel/UCxjIevJqDzg8kd9zSQp5SqA",
  },
];

function socialIconSvg(network: "instagram" | "facebook" | "youtube"): string {
  if (network === "instagram") {
    return `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="18" height="18"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm11 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7.5A4.5 4.5 0 1 1 12 16.5 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 12 14.5 2.5 2.5 0 0 0 12 9.5z"/></svg>`;
  }
  if (network === "facebook") {
    return `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="18" height="18"><path fill="currentColor" d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z"/></svg>`;
  }
  return `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="18" height="18"><path fill="currentColor" d="M23 7.5a3.5 3.5 0 0 0-2.5-2.5C18.6 4.5 12 4.5 12 4.5s-6.6 0-8.5.5A3.5 3.5 0 0 0 1 7.5 36.4 36.4 0 0 0 .5 12a36.4 36.4 0 0 0 .5 4.5 3.5 3.5 0 0 0 2.5 2.5c1.9.5 8.5.5 8.5.5s6.6 0 8.5-.5a3.5 3.5 0 0 0 2.5-2.5A36.4 36.4 0 0 0 23.5 12a36.4 36.4 0 0 0-.5-4.5zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>`;
}

function socialLinksHtml(): string {
  return `<nav class="socials" aria-label="Social media">
      ${SOCIAL.map(
        (item) =>
          `<a href="${item.href}" target="_blank" rel="noreferrer" title="${escape(item.label)} ${escape(item.handle)}" aria-label="${escape(item.label)} ${escape(item.handle)}">${socialIconSvg(item.network)}</a>`,
      ).join("\n      ")}
    </nav>`;
}

function socialInlineHtml(): string {
  const unique = [
    { network: "instagram" as const, label: "Instagram", href: "https://www.instagram.com/inyourcornerboxing/" },
    { network: "facebook" as const, label: "Facebook", href: "https://www.facebook.com/groups/511510502872483" },
    { network: "youtube" as const, label: "YouTube", href: "https://www.youtube.com/channel/UCxjIevJqDzg8kd9zSQp5SqA" },
  ];
  return `<p class="social-inline">
          ${unique
            .map(
              (item) =>
                `<a href="${item.href}" target="_blank" rel="noreferrer">${socialIconSvg(item.network)}<span>${escape(item.label)}</span></a>`,
            )
            .join("\n          ")}
        </p>`;
}

function shell(active: string, title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="https://www.inyourcornerfitness.com/">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${IMG.training}">
  <link rel="icon" href="${IMG.logo}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "LocalBusiness", "HealthClub"],
    name: "In Your Corner Boxing",
    url: "https://www.inyourcornerfitness.com/",
    email: "inyourcornerboxing@yahoo.com",
    image: IMG.training,
    address: {
      "@type": "PostalAddress",
      streetAddress: "1 Wolcott Rd",
      addressLocality: "Wolcott",
      addressRegion: "CT",
      postalCode: "06716",
      addressCountry: "US",
    },
    areaServed: "Wolcott, CT",
    description,
  })}</script>
</head>
<body>
  <div class="ring-frame" aria-hidden="true"></div>
  <p class="utility-bar">
    <span>1 Wolcott Rd, Wolcott CT 06716</span>
    <span class="dot" aria-hidden="true"></span>
    <span>Real boxing · Fitness · Nutrition</span>
    <span class="dot" aria-hidden="true"></span>
    <a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a>
  </p>
  <header class="site-header">
    <a class="brand" href="index.html">
      <img src="${IMG.logo}" alt="In Your Corner Boxing logo" width="56" height="56">
      <span>
        <strong>In Your Corner Boxing</strong>
        <small>Boxing · Fitness · Nutrition</small>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-label="Open menu" onclick="document.body.classList.toggle('nav-open')">Menu</button>
    <nav aria-label="Primary">
      <a href="index.html" class="${active === "home" ? "active" : ""}">Home</a>
      <a href="coaches.html" class="${active === "coaches" ? "active" : ""}">Meet the Coaches</a>
      <a href="fight-back.html" class="${active === "fight" ? "active" : ""}">Fight Back IYC</a>
      <a href="https://www.girlboxingclub.com/" target="_blank" rel="noreferrer">GiRL Boxing Club</a>
      <a href="testimonials.html" class="${active === "testimonials" ? "active" : ""}">Testimonials</a>
      <a class="btn btn-nav" href="book.html">Book Now</a>
    </nav>
  </header>
  ${body}
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-head">
          <img src="${IMG.logo}" alt="" width="64" height="64">
          <div>
            <h2>In Your Corner Boxing</h2>
            <p class="footer-tag">Boxing · Fitness · Nutrition · Wolcott, CT</p>
          </div>
        </div>
        <p>A gym family where every member is truly in your corner.</p>
        ${socialLinksHtml()}
      </div>
      <div>
        <h3>Visit</h3>
        <ul class="footer-list">
          <li>1 Wolcott Rd<br>Wolcott, CT 06716</li>
          <li><a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a></li>
        </ul>
      </div>
      <div>
        <h3>Train</h3>
        <ul class="footer-list">
          <li><a href="book.html">Class schedule &amp; pricing</a></li>
          <li><a href="coaches.html">Meet the coaches</a></li>
          <li><a href="fight-back.html">Fight Back IYC</a></li>
          <li><a href="https://www.inyourcornerfitness.com/iyc-gear" target="_blank" rel="noreferrer">IYC Gear</a></li>
        </ul>
      </div>
    </div>
    <p class="fine">© ${new Date().getFullYear()} In Your Corner Boxing · Wolcott, Connecticut</p>
  </footer>
</body>
</html>`;
}

function pageHome(): string {
  return shell(
    "home",
    "In Your Corner Boxing | Wolcott, CT",
    "Boxing, fitness, and nutrition coaching in Wolcott, CT. Classes for kids, teens, adults, 55+, and Fight Back IYC for movement disorders.",
    `
  <main>
    <section class="hero">
      <div class="hero-media">
        <img src="${IMG.training}" alt="Boxing training on the floor at In Your Corner Boxing in Wolcott, CT" width="1600" height="1100" fetchpriority="high">
      </div>
      <div class="hero-copy wrap">
        <p class="corner-mark"><span>Red corner</span> · Wolcott, CT</p>
        <h1>In Your Corner Boxing</h1>
        <p class="punchline">Train hard. Punch with purpose.</p>
        <p class="lede">Real boxing skills, strength training, and nutrition coaching for every age and ability — in one corner of Wolcott.</p>
        <div class="actions">
          <a class="btn btn-primary" href="book.html">Book a class</a>
          <a class="btn btn-ghost" href="coaches.html">Meet the coaches</a>
        </div>
      </div>
    </section>

    <section class="wrap rounds" aria-label="What we train">
      <article class="round">
        <p class="round-num">Round 01</p>
        <h2>Boxing</h2>
        <p>Learn real boxing skills and techniques. Get into fighting shape with drills that build cardio, core strength, balance, coordination, and power. Relieve stress while building confidence. Private training and classes for all ages and levels — including non-contact, mitts, sparring, heavy bag, speed bag, senior boxing, youth boxing, and boxing for movement disorders.</p>
      </article>
      <article class="round">
        <p class="round-num">Round 02</p>
        <h2>Fitness</h2>
        <p>Build strength, lose weight, burn fat, feel better. Join a class or sign up for private training at IYC in Wolcott, CT — boot camps, circuit training, strength &amp; conditioning, and one-on-one coaching whether boxing is your focus or not.</p>
      </article>
      <article class="round">
        <p class="round-num">Round 03</p>
        <h2>Nutrition</h2>
        <p>Precision Nutrition–informed coaching to reach your goals without feeling deprived. Individual coaching and small group classes that teach lasting skills — not a crash diet or quick fix.</p>
      </article>
    </section>

    <section class="band band-action">
      <div class="wrap split">
        <div>
          <p class="eyebrow">Our philosophy</p>
          <h2>Fitness is for everyone</h2>
          <p>At our gym we believe fitness is for everyone — and that starts with creating a space where people of all ages, abilities, and backgrounds feel welcome. We offer boxing classes beginning as young as age three, building confidence, coordination, and strength from the very start. Our programs continue across all age groups, including specialized classes for adults 55+ and individuals living with Parkinson’s, where movement, community, and support are at the center of every session.</p>
          <p>Through our nonprofit, <a href="https://www.girlboxingclub.com/" target="_blank" rel="noreferrer">GiRL Boxing Club Inc.</a>, we offer free classes that empower young girls with confidence, strength, and community.</p>
          <p>More than a place to work out, we are a gym family. This is where fitness meets community — and where every member is truly in your corner.</p>
          <a class="btn btn-primary" href="fight-back.html">Explore Fight Back IYC</a>
        </div>
        <div class="stack-photos">
          <img src="${IMG.community}" alt="IYC members after training together" width="1400" height="900" loading="lazy">
          <img src="${IMG.seniors}" alt="55+ and Fight Back members at In Your Corner Boxing" width="1400" height="900" loading="lazy">
        </div>
      </div>
    </section>

    <section class="floor-band">
      <div class="wrap floor-grid">
        <figure class="floor-shot">
          <img src="${IMG.gear}" alt="Boxing gloves and gear at In Your Corner Boxing" width="1200" height="900" loading="lazy">
          <figcaption>Gloves on. Work starts here.</figcaption>
        </figure>
        <figure class="floor-shot">
          <img src="${IMG.building}" alt="In Your Corner Boxing gym at 1 Wolcott Rd, Wolcott CT" width="1600" height="1100" loading="lazy">
          <figcaption>1 Wolcott Rd — walk into the corner.</figcaption>
        </figure>
      </div>
    </section>

    <section class="wrap">
      <div class="section-head">
        <p class="eyebrow">This week on the floor</p>
        <h2>Fight card</h2>
      </div>
      <div class="schedule" role="list">
        <div role="listitem"><strong>Mon</strong><span>5:00 PM Tiny Champs (3–6)</span><span>6:00 PM Circuit Training</span></div>
        <div role="listitem"><strong>Tue</strong><span>6:00 PM Youth Boxing (6–12)</span><span>6:00 PM Boxing Bootcamp</span><span>7:00 PM Teen Boxing (12–17)</span></div>
        <div role="listitem"><strong>Wed</strong><span>10:00 AM 55+ Boxing</span><span>6:00 PM Boxing Heavy Bags</span></div>
        <div role="listitem"><strong>Thu</strong><span>6:00 PM Youth Boxing</span><span>6:00 PM Bootcamp</span></div>
        <div role="listitem"><strong>Fri</strong><span>4:30 PM Teen/Adult Boxing</span></div>
        <div role="listitem"><strong>Sat</strong><span>9:00 AM Boxing: Heavy Bags</span></div>
        <div role="listitem"><strong>Sun</strong><span>8:00 AM Bags &amp; Mitts</span><span>9:00 AM Bootcamp</span><span>10:00 AM Strength: Total Body</span></div>
      </div>
      <p class="note">Sign up in the GloFox app · Full pricing on the <a href="book.html">Book Now</a> page</p>
    </section>

    <section class="cta-band">
      <div class="wrap">
        <img class="cta-logo" src="${IMG.logo}" alt="In Your Corner Boxing logo" width="96" height="96">
        <h2>Ready to step into the corner?</h2>
        <p>1 Wolcott Rd, Wolcott CT 06716 · <a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a></p>
        ${socialInlineHtml()}
        <a class="btn btn-primary" href="book.html">Book with GloFox</a>
      </div>
    </section>
  </main>`,
  );
}

function pageCoaches(): string {
  return shell(
    "coaches",
    "Meet the Coaches | In Your Corner Boxing",
    "Meet Stephanie Ballesteros, Mya Soto, Tyler Marcelynas, Cynthia Villalobos, and Amina Ayrula — the coaching team at In Your Corner Boxing in Wolcott, CT.",
    `
  <main class="page">
    <section class="page-hero wrap">
      <p class="eyebrow">The IYC corner</p>
      <h1>Meet the Coaches</h1>
      <p class="lede">Experience, heart, and high standards — the team that keeps Wolcott showing up.</p>
    </section>
    <section class="wrap coach-grid">
      <article class="coach">
        <img src="${IMG.coachStephanie}" alt="Stephanie Ballesteros, owner and head coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Stephanie Ballesteros</h2>
          <p class="role">Owner &amp; Head Coach</p>
          <p>Coach Stephanie is the owner and head coach of IYC, and the driving force behind the community. She founded the gym during COVID — first virtually, then her garage, now the thriving space on Wolcott Rd. With 18 years as a personal trainer and 15 years as a boxing coach, she leads with experience, authenticity, and care. Her vision is a gym family where people feel challenged, supported, and connected.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coachMya}" alt="Mya Soto, boxing coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Mya Soto</h2>
          <p class="role">Boxing Coach</p>
          <p>Part of the IYC family since June 2022, Mya moved from athlete to assistant coach to leading boxing classes and private sessions. She specializes in high-energy mitt work and heavy bag training, and shines with youth athletes — especially Tiny Champs ages 3–5. She coaches with confidence, precision, and purpose.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coachTyler}" alt="Tyler Marcelynas, certified personal trainer" width="800" height="1000" loading="lazy">
        <div>
          <h2>Tyler Marcelynas</h2>
          <p class="role">Certified Personal Trainer</p>
          <p>With IYC since day one, Tyler went from brand-new lifter to certified coach. He leads Teen Lift and adult strength classes — Leg Day, Arms, Back/Chest — and brings a safety-first approach shaped by his own training journey. He represents everything IYC stands for: growth, dedication, and community.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coachCynthia}" alt="Cynthia Villalobos, personal trainer and CrossFit coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Cynthia Villalobos</h2>
          <p class="role">Certified Personal Trainer &amp; CrossFit Coach</p>
          <p>From competitive swimming in Perú to corporate wellness at ESPN, Cynthia brings 15+ years helping people move better and get stronger. A CrossFit Level 2 trainer with nearly a decade of L2 coaching, she’s been with IYC since the pandemic Zoom days — tough, technical, and ready to meet you where you are.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coachAmina}" alt="Amina Ayrula, boxing coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Amina Ayrula</h2>
          <p class="role">Boxing Coach</p>
          <p>Amina has been part of the IYC family since she was 7 — nearly half her life — and is now our youngest coach. She assists and leads Youth classes after training alongside Coach Stephanie and Coach Mya, connecting with kids while teaching technique, confidence, and a love for boxing.</p>
        </div>
      </article>
    </section>
  </main>`,
  );
}

function pageTestimonials(): string {
  return shell(
    "testimonials",
    "Testimonials | In Your Corner Boxing",
    "What members say about training at In Your Corner Boxing in Wolcott, CT.",
    `
  <main class="page">
    <section class="page-hero wrap">
      <p class="eyebrow">From the corner</p>
      <h1>Testimonials</h1>
      <p class="lede">Real members. Real results. Real community.</p>
    </section>
    <section class="wrap quote-grid">
      <blockquote>
        <p>“Her workouts are tough AF and I train with her 5–6 days a week now between zoom and personal training… I even canceled my gym membership because I plan on sticking with Steph.”</p>
        <cite>— DH</cite>
      </blockquote>
      <blockquote>
        <p>“I am a 60 year old, overweight woman who is very self conscious when I exercise. In Your Corner Fitness is perfect for me. Stephanie is very welcoming, supportive and inspirational… I am stronger. I have more energy. I am more confident.”</p>
        <cite>— LG</cite>
      </blockquote>
      <blockquote>
        <p>“An added bonus is that I managed to get my wife to train with me and now our 2 kids ages 9 and 12 are doing her Sunday Family Fitness class and my 12-year-old son is now boxing with us as well.”</p>
        <cite>— DH</cite>
      </blockquote>
    </section>
    <section class="wrap cta-inline">
      <a class="btn btn-primary" href="book.html">Start your story</a>
    </section>
  </main>`,
  );
}

function pageFightBack(): string {
  return shell(
    "fight",
    "Fight Back IYC | Boxing for Movement Disorders",
    "Stand Up Fight Back IYC is a non-contact boxing program for people fighting movement disorders, including Parkinson’s, at In Your Corner Boxing in Wolcott, CT.",
    `
  <main class="page">
    <section class="wrap split program">
      <div>
        <p class="eyebrow">Special program</p>
        <h1>Fight Back IYC</h1>
        <p class="lede">Stand Up. Fight Back. Non-contact boxing for movement disorders.</p>
        <p>Stand Up Fight Back IYC is a boxing program designed for those fighting back against any movement disorder.</p>
        <p>This is a non-contact class where we work all the skills and drills of a boxer. The benefits of boxing are endless — for those with movement disorders, the major benefits include decreasing progression of the disease and increasing quality of life.</p>
        <p>In Your Corner Boxing is a boxing gym, and when you walk through the door you are a boxer. You will be taught the basics of boxing to prepare you to <strong>FIGHT BACK</strong>.</p>
        <a class="btn btn-primary" href="book.html">Ask about Fight Back classes</a>
      </div>
      <img src="${IMG.seniors}" alt="Fight Back and 55+ members training at IYC" width="1400" height="900" loading="lazy">
    </section>
  </main>`,
  );
}

function pageBook(): string {
  return shell(
    "book",
    "Book Now | In Your Corner Boxing Pricing & Schedule",
    "Book classes and training at In Your Corner Boxing in Wolcott, CT. Pricing for memberships, private training, nutrition coaching, and the weekly class schedule.",
    `
  <main class="page">
    <section class="page-hero wrap">
      <p class="eyebrow">Book Now</p>
      <h1>Train with IYC</h1>
      <p class="lede">Download GloFox, search In Your Corner Boxing, and reserve your spot.</p>
    </section>

    <section class="wrap steps">
      <article><h3>1</h3><p>Download the <strong>GloFox</strong> app from the App Store or Google Play.</p></article>
      <article><h3>2</h3><p>Search for <strong>In Your Corner Boxing</strong> and create an account with your email.</p></article>
      <article><h3>3</h3><p>Book classes, memberships, or training. Current members can use Forgot Password to recover access.</p></article>
    </section>

    <section class="wrap">
      <div class="section-head"><h2>Pricing</h2></div>
      <div class="price-grid">
        <article>
          <h3>Classes</h3>
          <ul>
            <li>Drop-in class <strong>$15</strong></li>
            <li>Adult unlimited month <strong>$150</strong></li>
            <li>Youth monthly <strong>$100</strong></li>
            <li>Teen monthly <strong>$120</strong></li>
            <li>1 adult + child <strong>$180</strong></li>
            <li>2 adults + up to 2 children <strong>$230</strong></li>
          </ul>
        </article>
        <article>
          <h3>In-person training</h3>
          <ul>
            <li>Private <strong>$35 / 30 min</strong> · <strong>$70 / hour</strong></li>
            <li>Small group (2–6) <strong>$15 / person / 30 min</strong></li>
          </ul>
        </article>
        <article>
          <h3>Online training</h3>
          <ul>
            <li>Private <strong>$30 / 30 min</strong> · <strong>$60 / hour</strong></li>
            <li>Small group / team <strong>$15 each / 30 min</strong></li>
          </ul>
        </article>
        <article>
          <h3>Nutrition</h3>
          <ul>
            <li>6-week nutrition coaching <strong>$120</strong></li>
            <li>Precision Nutrition–informed · individual &amp; small group</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="wrap">
      <div class="section-head"><h2>Weekly schedule</h2><p class="note">1 Wolcott Rd, Wolcott CT</p></div>
      <div class="schedule dense">
        <div><strong>Monday</strong><span>5:00 pm Tiny Champs Boxing (ages 3–6)</span><span>6:00 pm Circuit Training</span></div>
        <div><strong>Tuesday</strong><span>6:00 pm Youth Boxing (ages 6–12)</span><span>6:00 pm Boxing Bootcamp</span><span>7:00 pm Teen Boxing (ages 12–17)</span></div>
        <div><strong>Wednesday</strong><span>10:00 am 55+ Boxing</span><span>6:00 pm Boxing Heavy Bags</span></div>
        <div><strong>Thursday</strong><span>6:00 pm Youth Boxing (ages 6–12)</span><span>6:00 pm Bootcamp</span></div>
        <div><strong>Friday</strong><span>4:30 pm Teen/Adult Boxing</span></div>
        <div><strong>Saturday</strong><span>9:00 am Boxing: Heavy Bags</span></div>
        <div><strong>Sunday</strong><span>8:00 am Boxing Bags and Mitts</span><span>9:00 am Bootcamp</span><span>10:00 am Strength: Total Body</span></div>
      </div>
    </section>

    <section class="cta-band">
      <div class="wrap">
        <h2>Questions before you book?</h2>
        <p><a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a> · 1 Wolcott Rd, Wolcott CT 06716</p>
      </div>
    </section>
  </main>`,
  );
}

function siteCss(): string {
  return `:root {
  --bg: #050505;
  --bg-2: #0d0b0a;
  --canvas: #14110f;
  --panel: #1a1614;
  --red: #e10600;
  --red-deep: #9d0000;
  --red-glow: rgba(225, 6, 0, 0.45);
  --rope: #c9a36a;
  --rope-dim: rgba(201, 163, 106, 0.35);
  --text: #f4f1ea;
  --muted: #b8aea3;
  --line: #2c2622;
  --max: 1120px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: "DM Sans", system-ui, sans-serif;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(225, 6, 0, 0.18), transparent 55%),
    radial-gradient(900px 500px at 100% 0%, rgba(201, 163, 106, 0.08), transparent 50%),
    var(--bg);
  color: var(--text);
  line-height: 1.55;
  position: relative;
}
a { color: inherit; }
img { display: block; max-width: 100%; }
.wrap { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto; }

.ring-frame {
  pointer-events: none;
  position: fixed;
  inset: 0.55rem;
  border: 2px solid var(--rope-dim);
  border-radius: 0.2rem;
  box-shadow:
    inset 0 0 0 1px rgba(225, 6, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.65);
  z-index: 100;
  animation: ropePulse 5.5s ease-in-out infinite;
}
@keyframes ropePulse {
  0%, 100% { border-color: rgba(201, 163, 106, 0.28); }
  50% { border-color: rgba(201, 163, 106, 0.55); }
}

.utility-bar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.55rem 0.85rem;
  margin: 0; padding: 0.45rem 1rem;
  background: #000;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.utility-bar a { color: var(--text); text-decoration: none; }
.utility-bar a:hover { color: var(--red); }
.utility-bar .dot {
  width: 0.28rem; height: 0.28rem; border-radius: 50%;
  background: var(--red); display: inline-block;
}

.site-header {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.7rem max(1rem, calc((100% - var(--max)) / 2));
  background: rgba(5, 5, 5, 0.92);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px);
}
.brand { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; }
.brand img { border-radius: 50%; background: #000; border: 1px solid var(--rope-dim); }
.brand strong { display: block; font-size: 0.98rem; letter-spacing: 0.02em; }
.brand small { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
.site-header nav { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; }
.site-header nav a {
  text-decoration: none; color: var(--muted);
  font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700;
}
.site-header nav a:hover, .site-header nav a.active { color: var(--red); }
.nav-toggle {
  display: none; background: var(--panel); color: var(--text);
  border: 1px solid var(--line); border-radius: 0.2rem; padding: 0.55rem 0.8rem;
}

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.9rem 1.25rem; border-radius: 0.15rem; text-decoration: none;
  font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.82rem;
  border: 0; cursor: pointer;
}
.btn-primary {
  background: var(--red); color: white;
  box-shadow: 0 0 0 0 var(--red-glow);
  animation: cornerFlash 2.8s ease-in-out infinite;
}
.btn-primary:hover { background: var(--red-deep); }
.btn-ghost { border: 1px solid rgba(255,255,255,0.45); color: white; background: transparent; }
.btn-ghost:hover { border-color: var(--rope); color: var(--rope); }
.btn-nav { background: var(--red); color: white !important; padding: 0.55rem 0.9rem; border-radius: 0.15rem; }
@keyframes cornerFlash {
  0%, 100% { box-shadow: 0 0 0 0 rgba(225, 6, 0, 0); }
  50% { box-shadow: 0 0 22px 2px var(--red-glow); }
}

.hero {
  position: relative;
  min-height: min(88svh, 760px);
  display: grid;
  align-items: end;
  overflow: hidden;
}
.hero-media { position: absolute; inset: 0; }
.hero-media img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: center 30%;
  filter: contrast(1.08) saturate(0.92);
  transform: scale(1.04);
  animation: heroDrift 18s ease-in-out infinite alternate;
}
.hero-media::before {
  content: ""; position: absolute; inset: 0; z-index: 1;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.62) 42%, rgba(0,0,0,0.25) 100%),
    linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.86)),
    linear-gradient(135deg, rgba(225, 6, 0, 0.28), transparent 42%);
}
.hero-media::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 10px; z-index: 2;
  background: repeating-linear-gradient(
    90deg,
    var(--rope) 0 18px,
    #8a6a3a 18px 22px,
    var(--rope) 22px 40px,
    #5a3f1c 40px 44px
  );
  opacity: 0.9;
}
@keyframes heroDrift {
  from { transform: scale(1.04) translate3d(0, 0, 0); }
  to { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
}

.hero-copy {
  position: relative; z-index: 3;
  padding: 3.5rem 0 2.4rem;
  width: min(var(--max), calc(100% - 2rem));
  margin: 0 auto;
  animation: heroRise 0.9s ease-out both;
}
.hero-copy > * { max-width: 38rem; }
@keyframes heroRise {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}

.corner-mark {
  display: inline-flex; align-items: center; gap: 0.55rem;
  margin: 0 0 0.85rem;
  color: var(--rope);
  font-size: 0.78rem; font-weight: 800;
  letter-spacing: 0.16em; text-transform: uppercase;
}
.corner-mark span {
  display: inline-block;
  padding: 0.28rem 0.55rem;
  background: var(--red);
  color: #fff;
  letter-spacing: 0.12em;
}
.eyebrow {
  color: var(--red); text-transform: uppercase; letter-spacing: 0.14em;
  font-size: 0.78rem; font-weight: 800; margin: 0 0 0.55rem;
}
h1, h2, h3 {
  font-family: "Bebas Neue", Impact, sans-serif;
  letter-spacing: 0.03em; line-height: 0.92; margin: 0 0 0.55rem;
}
h1 {
  font-family: Anton, "Bebas Neue", Impact, sans-serif;
  font-size: clamp(3.2rem, 9vw, 6.2rem);
  color: #fff;
  text-shadow: 0 0 40px rgba(225, 6, 0, 0.25);
  max-width: 11ch;
}
.punchline {
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: clamp(1.55rem, 3.8vw, 2.45rem);
  margin: 0 0 0.85rem;
  letter-spacing: 0.08em;
  color: var(--red);
  text-transform: uppercase;
}
.lede { color: var(--muted); font-size: 1.02rem; margin: 0 0 1.25rem; line-height: 1.5; }
.actions { display: flex; flex-wrap: wrap; gap: 0.7rem; }

.rounds {
  display: grid; gap: 0;
  grid-template-columns: repeat(3, 1fr);
  padding: 0;
  border-block: 1px solid var(--line);
  background: var(--canvas);
}
.round {
  padding: 1.6rem 1.35rem 1.75rem;
  border-right: 1px solid var(--line);
  position: relative;
}
.round:last-child { border-right: 0; }
.round::before {
  content: "";
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, var(--red), transparent 70%);
  opacity: 0.85;
}
.round-num {
  margin: 0 0 0.55rem;
  color: var(--rope);
  font-size: 0.72rem; font-weight: 800;
  letter-spacing: 0.16em; text-transform: uppercase;
}
.rounds h2 { color: #fff; margin-bottom: 0.55rem; font-size: clamp(1.8rem, 3vw, 2.4rem); }
.rounds p:not(.round-num) { margin: 0; color: var(--muted); font-size: 0.95rem; }

.band { background: var(--bg-2); padding: 2.75rem 0; border-block: 1px solid var(--line); }
.band-action {
  background:
    linear-gradient(180deg, rgba(225, 6, 0, 0.06), transparent 40%),
    var(--bg-2);
}
.split { display: grid; gap: 1.75rem; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); align-items: start; }
.split > div:first-child { display: flex; flex-direction: column; gap: 0.75rem; max-width: 36rem; }
.split > div:first-child > p { margin: 0; }
.split > div:first-child > .lede { color: var(--muted); }
.split > div:first-child > .btn { align-self: flex-start; margin-top: 0.35rem; }
.stack-photos { display: grid; gap: 0.75rem; grid-template-columns: 1fr 1fr; align-self: stretch; }
.stack-photos img {
  width: 100%; aspect-ratio: 3 / 4; height: 100%; max-height: 420px;
  object-fit: cover; object-position: center 18%;
  border-radius: 0.15rem;
  border: 1px solid var(--line);
  filter: contrast(1.05);
}
.split > img {
  width: 100%; aspect-ratio: 4 / 5; max-height: 520px;
  object-fit: cover; object-position: center;
  border-radius: 0.15rem; border: 1px solid var(--line);
}
.program { padding: 1.75rem 0 2.5rem; }

.floor-band {
  padding: 0;
  border-bottom: 1px solid var(--line);
  background: #000;
}
.floor-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 0;
  width: min(100%, var(--max) + 2rem);
  padding: 0;
}
.floor-shot {
  margin: 0;
  position: relative;
  overflow: hidden;
  min-height: 280px;
}
.floor-shot img {
  width: 100%; height: 100%; min-height: 280px;
  object-fit: cover;
  filter: grayscale(0.15) contrast(1.08);
}
.floor-shot::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.78));
}
.floor-shot figcaption {
  position: absolute; left: 1.1rem; right: 1.1rem; bottom: 1rem; z-index: 1;
  margin: 0;
  font-family: "Bebas Neue", Impact, sans-serif;
  letter-spacing: 0.08em;
  font-size: 1.35rem;
  text-transform: uppercase;
}

.schedule { display: grid; gap: 0.75rem; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 0.5rem 0 0; }
.schedule.dense { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.schedule div {
  background: var(--panel);
  border: 1px solid var(--line);
  border-top: 3px solid var(--red);
  padding: 1rem 0.85rem;
  display: grid; gap: 0.4rem; align-content: start;
}
.schedule strong {
  color: var(--rope);
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: 1.35rem; letter-spacing: 0.04em;
}
.schedule span { color: var(--muted); font-size: 0.86rem; line-height: 1.35; }
.note { color: var(--muted); }
.section-head { margin: 2rem 0 1.2rem; }

.cta-band {
  padding: 3.25rem 0;
  background:
    linear-gradient(135deg, #220000 0%, #0a0807 42%, #160000 100%);
  border-top: 1px solid var(--line);
  text-align: center;
  position: relative;
}
.cta-band::before {
  content: "";
  position: absolute; left: 0; right: 0; top: 0; height: 4px;
  background: repeating-linear-gradient(90deg, var(--rope) 0 14px, var(--red) 14px 18px);
}
.cta-logo {
  width: 96px; height: 96px; margin: 0 auto 1rem; border-radius: 50%;
  background: #000; object-fit: cover; display: block;
  border: 2px solid var(--rope-dim);
}
.cta-band h2 { margin-bottom: 0.65rem; }
.social-icon { display: block; flex-shrink: 0; width: 1.1rem; height: 1.1rem; }
.social-inline { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.85rem; margin: 0.85rem 0 1.25rem; }
.social-inline a {
  display: inline-flex; align-items: center; gap: 0.4rem;
  color: var(--muted); text-decoration: none; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.8rem;
  padding: 0.45rem 0.75rem; border: 1px solid var(--line); background: rgba(0,0,0,0.35);
}
.social-inline a:hover { color: var(--text); border-color: var(--red); }
.social-inline a:hover .social-icon { color: var(--red); }

.page { padding-bottom: 3rem; }
.page-hero { padding: 1.9rem 0 1.1rem; }
.page-hero .lede { max-width: 36rem; margin-bottom: 0; }
.page-hero h1 { color: var(--red); max-width: none; text-shadow: none; }

.coach-grid {
  display: grid; gap: 1.35rem; grid-template-columns: 1fr;
  max-width: 52rem;
}
.coach {
  display: grid; gap: 1.35rem 1.5rem; grid-template-columns: 200px minmax(0, 1fr);
  align-items: center; background: transparent; border: 0; border-bottom: 1px solid var(--line);
  padding: 0 0 1.35rem;
}
.coach:last-child { border-bottom: 0; padding-bottom: 0; }
.coach img {
  width: 100%; aspect-ratio: 3 / 4; max-height: none; height: auto;
  object-fit: cover; object-position: center top; border-radius: 0.15rem;
  border: 1px solid var(--line);
  filter: contrast(1.06);
}
.coach > div { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; max-width: 38rem; }
.coach h2 { font-size: clamp(1.7rem, 2.6vw, 2.25rem); margin: 0; line-height: 0.95; letter-spacing: 0.02em; }
.coach .role { color: var(--red); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.78rem; margin: 0; }
.coach p:not(.role) { margin: 0; color: var(--muted); font-size: 1rem; line-height: 1.55; }

.quote-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
blockquote {
  margin: 0; background: var(--panel);
  border-left: 4px solid var(--red);
  border-top: 1px solid var(--line);
  padding: 1.25rem;
}
blockquote cite { color: var(--muted); font-style: normal; font-weight: 700; }

.steps, .price-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 2rem; }
.steps article, .price-grid article {
  background: var(--panel);
  border: 1px solid var(--line);
  border-top: 3px solid var(--rope);
  padding: 1.2rem;
}
.steps h3 { color: var(--red); font-size: 2.4rem; }
.price-grid ul { margin: 0; padding-left: 1.1rem; color: var(--muted); }
.price-grid li { margin: 0.4rem 0; }

.site-footer { border-top: 1px solid var(--line); padding: 2.25rem 0 1.75rem; background: #030303; }
.footer-grid {
  width: min(var(--max), calc(100% - 2rem)); margin: 0 auto 1.25rem;
  display: grid; gap: 1.75rem; grid-template-columns: 1.4fr 1fr 1fr; align-items: start;
}
.footer-brand-head { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.75rem; }
.footer-brand-head img { width: 64px; height: 64px; border-radius: 50%; background: #000; flex-shrink: 0; border: 1px solid var(--rope-dim); }
.footer-brand-head h2 { margin: 0; font-size: clamp(1.6rem, 3vw, 2.1rem); line-height: 0.95; }
.footer-tag { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
.footer-brand > p { margin: 0; color: var(--muted); max-width: 28rem; font-size: 0.95rem; }
.footer-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; color: var(--muted); font-size: 0.95rem; }
.footer-list a { color: var(--text); text-decoration: none; }
.footer-list a:hover { color: var(--red); }
.site-footer h3 { margin: 0 0 0.75rem; font-size: 1.35rem; letter-spacing: 0.06em; }
.socials { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 1rem; }
.socials a {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.5rem; height: 2.5rem; padding: 0; overflow: hidden;
  text-decoration: none; color: var(--text);
  border: 1px solid var(--line); background: var(--panel); border-radius: 0.2rem;
}
.socials a span { display: none; }
.socials a .social-icon { color: var(--red); width: 1.2rem; height: 1.2rem; }
.socials a:hover { border-color: var(--red); color: var(--red); background: #1a0000; }
.fine { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto; color: var(--muted); font-size: 0.85rem; }
.cta-inline { padding: 2rem 0; }

@media (prefers-reduced-motion: reduce) {
  .ring-frame, .btn-primary, .hero-media img, .hero-copy { animation: none; }
}

@media (max-width: 900px) {
  .ring-frame { inset: 0.35rem; }
  .hero { min-height: 78svh; }
  .hero-copy { padding: 2.2rem 0 1.7rem; }
  .rounds { grid-template-columns: 1fr; }
  .round { border-right: 0; border-bottom: 1px solid var(--line); }
  .round:last-child { border-bottom: 0; }
  .schedule { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .coach-grid { max-width: none; gap: 1.15rem; }
  .split, .footer-grid, .floor-grid { grid-template-columns: 1fr; }
  .coach { grid-template-columns: 112px minmax(0, 1fr); gap: 0.95rem; align-items: start; padding-bottom: 1.15rem; }
  .coach img { max-height: 168px; }
  .coach h2 { font-size: 1.45rem; }
  .coach p:not(.role) { font-size: 0.92rem; line-height: 1.5; }
  .split > div:first-child { max-width: none; }
  .stack-photos { grid-template-columns: 1fr 1fr; }
  .stack-photos img { max-height: 280px; aspect-ratio: 4 / 5; }
  .nav-toggle { display: inline-flex; }
  .site-header nav {
    display: none; position: absolute; inset: 100% 0 auto 0; background: #0b0908;
    flex-direction: column; align-items: flex-start; padding: 1rem; border-bottom: 1px solid var(--line);
  }
  body.nav-open .site-header nav { display: flex; }
  .utility-bar { justify-content: flex-start; }
}
`;
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
