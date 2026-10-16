import type { DraftSiteBrief, DraftSiteInput, DraftSiteResult } from "./site-draft.js";

export interface SiteFile {
  path: string;
  content: string;
}

export interface ProfessionalSiteResult extends DraftSiteResult {
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
 */
export function buildInYourCornerBoxingSite(input: DraftSiteInput): ProfessionalSiteResult {
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
      "Added clear local SEO title, meta description, and LocalBusiness/SportsActivityLocation schema.",
      "Published dedicated pages for coaches, testimonials, Fight Back IYC, and booking/pricing.",
      "Surfaced real address, email, class schedule, and membership pricing from the source site.",
    ],
    findingsAddressed: [...new Set(input.findings.map((f) => f.code))],
    summary:
      "Final professional website for In Your Corner Boxing in Wolcott, CT — rebuilt from the current site’s content, branding, coaches, schedule, and pricing.",
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
  coach1:
    "https://static.wixstatic.com/media/368ba1_6f26cc7c9bcd40fcb683dcd0c62866b2~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/stephanie.jpg",
  coach2:
    "https://static.wixstatic.com/media/368ba1_4b93654e038d467197db359beeae76e1~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/mya.jpg",
  coach3:
    "https://static.wixstatic.com/media/368ba1_2df2787ac89441d7bc144e3c830a97db~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/tyler.jpg",
  coach4:
    "https://static.wixstatic.com/media/368ba1_f7b40c30da604043825fc71e6c826ac6~mv2.jpg/v1/fill/w_800,h_1000,al_c,q_85,enc_auto/cynthia.jpg",
};

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
  <meta property="og:image" content="${IMG.building}">
  <link rel="icon" href="${IMG.logo}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "LocalBusiness", "HealthClub"],
    name: "In Your Corner Boxing",
    url: "https://www.inyourcornerfitness.com/",
    email: "inyourcornerboxing@yahoo.com",
    image: IMG.building,
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
      <div>
        <img src="${IMG.logo}" alt="" width="72" height="72">
        <h2>In Your Corner Boxing</h2>
        <p>Boxing · Fitness · Nutrition in Wolcott, CT. A gym family where every member is truly in your corner.</p>
      </div>
      <div>
        <h3>Visit</h3>
        <p>1 Wolcott Rd<br>Wolcott, CT 06716</p>
        <p><a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a></p>
      </div>
      <div>
        <h3>Train</h3>
        <p><a href="book.html">Class schedule &amp; pricing</a></p>
        <p><a href="coaches.html">Meet the coaches</a></p>
        <p><a href="https://www.inyourcornerfitness.com/iyc-gear" target="_blank" rel="noreferrer">IYC Gear</a></p>
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
        <img src="${IMG.building}" alt="In Your Corner Boxing gym at 1 Wolcott Rd, Wolcott CT" width="1600" height="1100" fetchpriority="high">
      </div>
      <div class="hero-copy wrap">
        <p class="eyebrow">Wolcott, Connecticut</p>
        <h1>In Your Corner Boxing</h1>
        <p class="tagline">Boxing · Fitness · Nutrition</p>
        <p class="lede">A gym family for every age and ability — real boxing skills, strength training, and nutrition coaching in one welcoming corner of Wolcott.</p>
        <div class="actions">
          <a class="btn btn-primary" href="book.html">Book a class</a>
          <a class="btn btn-ghost" href="coaches.html">Meet the coaches</a>
        </div>
      </div>
    </section>

    <section class="wrap pillars">
      <article>
        <h2>Boxing</h2>
        <p>Learn real boxing skills and techniques. Get into fighting shape with drills that build cardio, core strength, balance, coordination, and power. Relieve stress while building confidence. Private training and classes for all ages and levels — including non-contact, mitts, sparring, heavy bag, speed bag, senior boxing, youth boxing, and boxing for movement disorders.</p>
      </article>
      <article>
        <h2>Fitness</h2>
        <p>Build strength, lose weight, burn fat, feel better. Join a class or sign up for private training at IYC in Wolcott, CT — boot camps, circuit training, strength &amp; conditioning, and one-on-one coaching whether boxing is your focus or not.</p>
      </article>
      <article>
        <h2>Nutrition</h2>
        <p>Precision Nutrition–informed coaching to reach your goals without feeling deprived. Individual coaching and small group classes that teach lasting skills — not a crash diet or quick fix.</p>
      </article>
    </section>

    <section class="band">
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

    <section class="wrap">
      <div class="section-head">
        <p class="eyebrow">This week on the floor</p>
        <h2>Class snapshot</h2>
      </div>
      <div class="schedule">
        <div><strong>Mon</strong><span>5:00 Tiny Champs (3–6)</span><span>6:00 Circuit Training</span></div>
        <div><strong>Tue</strong><span>6:00 Youth Boxing (6–12)</span><span>6:00 Boxing Bootcamp</span><span>7:00 Teen Boxing (12–17)</span></div>
        <div><strong>Wed</strong><span>10:00 55+ Boxing</span><span>6:00 Boxing Heavy Bags</span></div>
        <div><strong>Thu</strong><span>6:00 Youth Boxing</span><span>6:00 Bootcamp</span></div>
        <div><strong>Fri</strong><span>4:30 Teen/Adult Boxing</span></div>
        <div><strong>Sat</strong><span>9:00 Boxing: Heavy Bags</span></div>
        <div><strong>Sun</strong><span>8:00 Bags &amp; Mitts</span><span>9:00 Bootcamp</span><span>10:00 Strength: Total Body</span></div>
      </div>
      <p class="note">Sign up in the GloFox app · Full pricing on the <a href="book.html">Book Now</a> page</p>
    </section>

    <section class="cta-band">
      <div class="wrap">
        <h2>Ready to step into the corner?</h2>
        <p>1 Wolcott Rd, Wolcott CT 06716 · <a href="mailto:inyourcornerboxing@yahoo.com">inyourcornerboxing@yahoo.com</a></p>
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
    "Meet Stephanie Ballesteros, Mya Soto, Tyler Marcelynas, and Cynthia Villalobos — the coaching team at In Your Corner Boxing in Wolcott, CT.",
    `
  <main class="page">
    <section class="page-hero wrap">
      <p class="eyebrow">The IYC family</p>
      <h1>Meet the Coaches</h1>
      <p class="lede">Experience, heart, and high standards — the team that keeps Wolcott showing up.</p>
    </section>
    <section class="wrap coach-grid">
      <article class="coach">
        <img src="${IMG.coach1}" alt="Stephanie Ballesteros, owner and head coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Stephanie Ballesteros</h2>
          <p class="role">Owner &amp; Head Coach</p>
          <p>Coach Stephanie is the owner and head coach of IYC, and the driving force behind the community. With 18 years as a personal trainer and 15 years as a boxing coach, she brings deep knowledge, passion, and purpose to everything she builds. She started IYC during the pandemic — first virtually, then a garage, now a thriving gym on Wolcott Rd — with a vision to create a strong, supportive community through fitness, health, and boxing.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coach2}" alt="Mya Soto, boxing coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Mya Soto</h2>
          <p class="role">Boxing Coach</p>
          <p>Part of the IYC family since June 2022, Mya moved from athlete to assistant coach to leading boxing classes and private sessions. She specializes in high-energy mitt work and heavy bag training, and shines with youth athletes — especially Tiny Champs ages 3–5. A two-time class president, she coaches with confidence, precision, and purpose.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coach3}" alt="Tyler Marcelynas, certified personal trainer" width="800" height="1000" loading="lazy">
        <div>
          <h2>Tyler Marcelynas</h2>
          <p class="role">Certified Personal Trainer</p>
          <p>With IYC since day one, Tyler went from brand-new lifter to certified coach. He leads Teen Lift and adult strength classes — Leg Day, Arms, Back/Chest — and brings a safety-first approach shaped by his own training journey. He represents everything IYC stands for: growth, dedication, and community.</p>
        </div>
      </article>
      <article class="coach">
        <img src="${IMG.coach4}" alt="Cynthia Villalobos, personal trainer and CrossFit coach" width="800" height="1000" loading="lazy">
        <div>
          <h2>Cynthia Villalobos</h2>
          <p class="role">Certified Personal Trainer &amp; CrossFit Coach</p>
          <p>From competitive swimming in Perú to corporate wellness at ESPN, Cynthia brings 15+ years helping people move better and get stronger. A CrossFit Level 2 trainer with nearly a decade of L2 coaching, she’s been with IYC since the pandemic Zoom days — tough, technical, and ready to meet you where you are.</p>
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
    <section class="page-hero wrap">
      <p class="eyebrow">Special program</p>
      <h1>Fight Back IYC</h1>
      <p class="lede">Stand Up. Fight Back. Non-contact boxing for movement disorders.</p>
    </section>
    <section class="wrap split">
      <div>
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
  --bg: #070707;
  --bg-2: #111;
  --panel: #161616;
  --red: #e10600;
  --red-deep: #b00000;
  --text: #f5f5f5;
  --muted: #b7b7b7;
  --line: #2a2a2a;
  --max: 1120px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: Manrope, system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
}
a { color: inherit; }
img { display: block; max-width: 100%; }
.wrap { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto; }
.site-header {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.7rem max(1rem, calc((100% - var(--max)) / 2));
  background: rgba(7,7,7,0.94); border-bottom: 1px solid var(--line);
  backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; }
.brand img { border-radius: 50%; background: #000; }
.brand strong { display: block; font-size: 0.98rem; letter-spacing: 0.02em; }
.brand small { color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
.site-header nav { display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center; }
.site-header nav a { text-decoration: none; color: var(--muted); font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
.site-header nav a:hover, .site-header nav a.active { color: var(--red); }
.nav-toggle { display: none; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 0.4rem; padding: 0.55rem 0.8rem; }
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.2rem; border-radius: 0.35rem; text-decoration: none;
  font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.85rem;
  border: 0; cursor: pointer;
}
.btn-primary { background: var(--red); color: white; }
.btn-primary:hover { background: var(--red-deep); }
.btn-ghost { border: 1px solid rgba(255,255,255,0.45); color: white; background: transparent; }
.btn-nav { background: var(--red); color: white !important; padding: 0.55rem 0.9rem; border-radius: 0.3rem; }
.hero { position: relative; min-height: 52svh; max-height: 640px; display: grid; align-items: end; }
.hero-media { position: absolute; inset: 0; }
.hero-media img { width: 100%; height: 100%; object-fit: cover; object-position: center 40%; }
.hero-media::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 48%, rgba(0,0,0,0.28) 100%),
    linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.78));
}
.hero-copy {
  position: relative; z-index: 1;
  padding: 2.25rem 0 1.75rem;
  width: min(var(--max), calc(100% - 2rem));
  margin: 0 auto;
}
.hero-copy > * { max-width: 34rem; }
.eyebrow { color: var(--red); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.78rem; font-weight: 800; margin: 0 0 0.55rem; }
h1, h2, h3 { font-family: "Bebas Neue", Impact, sans-serif; letter-spacing: 0.03em; line-height: 0.95; margin: 0 0 0.55rem; }
h1 { font-size: clamp(2.8rem, 7vw, 4.6rem); color: var(--red); }
h2 { font-size: clamp(2rem, 4.5vw, 3rem); }
.tagline { font-family: "Bebas Neue", Impact, sans-serif; font-size: clamp(1.25rem, 3vw, 1.9rem); margin: 0 0 0.75rem; letter-spacing: 0.08em; }
.lede { color: var(--muted); font-size: 1rem; margin: 0 0 1.1rem; line-height: 1.5; }
.actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
.pillars { display: grid; gap: 0.85rem; grid-template-columns: repeat(3, 1fr); padding: 2rem 0; }
.pillars article { background: var(--panel); border: 1px solid var(--line); padding: 1.15rem 1.2rem; }
.pillars h2 { color: var(--red); margin-bottom: 0.45rem; }
.pillars p { margin: 0; color: var(--muted); font-size: 0.95rem; }
.band { background: var(--bg-2); padding: 2.5rem 0; border-block: 1px solid var(--line); }
.split { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); align-items: center; }
.split > div:first-child { display: flex; flex-direction: column; justify-content: center; max-width: 36rem; }
.stack-photos { display: grid; gap: 0.75rem; grid-template-columns: 1fr 1fr; align-self: stretch; }
.stack-photos img {
  width: 100%; aspect-ratio: 3 / 4; height: 100%; max-height: 420px;
  object-fit: cover; object-position: center 18%; border-radius: 0.35rem;
}
.split > img, .coach img { width: 100%; object-fit: cover; border-radius: 0.35rem; }
.schedule { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.schedule div { background: var(--panel); border: 1px solid var(--line); padding: 1rem; display: grid; gap: 0.35rem; }
.schedule strong { color: var(--red); font-family: "Bebas Neue", Impact, sans-serif; font-size: 1.35rem; letter-spacing: 0.04em; }
.schedule span { color: var(--muted); font-size: 0.9rem; }
.note { color: var(--muted); }
.cta-band { padding: 3.5rem 0; background: linear-gradient(135deg, #1a0000, #0d0d0d 45%, #140000); border-top: 1px solid var(--line); text-align: center; }
.page { padding-bottom: 3rem; }
.page-hero { padding: 3rem 0 1.5rem; }
.coach-grid { display: grid; gap: 2rem; }
.coach { display: grid; gap: 1.25rem; grid-template-columns: 280px 1fr; background: var(--panel); border: 1px solid var(--line); padding: 1rem; }
.coach .role { color: var(--red); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.8rem; }
.quote-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
blockquote { margin: 0; background: var(--panel); border-left: 4px solid var(--red); padding: 1.25rem; }
blockquote cite { color: var(--muted); font-style: normal; font-weight: 700; }
.steps, .price-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 2rem; }
.steps article, .price-grid article { background: var(--panel); border: 1px solid var(--line); padding: 1.2rem; }
.steps h3 { color: var(--red); font-size: 2.4rem; }
.price-grid ul { margin: 0; padding-left: 1.1rem; color: var(--muted); }
.price-grid li { margin: 0.4rem 0; }
.site-footer { border-top: 1px solid var(--line); padding: 2.5rem 0 2rem; background: #050505; }
.footer-grid { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto 1.5rem; display: grid; gap: 1.5rem; grid-template-columns: 1.4fr 1fr 1fr; }
.fine { width: min(var(--max), calc(100% - 2rem)); margin: 0 auto; color: var(--muted); font-size: 0.85rem; }
.cta-inline { padding: 2rem 0; }
.section-head { margin-bottom: 1.2rem; }
@media (max-width: 900px) {
  .hero { min-height: 48svh; max-height: none; }
  .hero-copy { padding: 1.75rem 0 1.4rem; }
  .pillars { grid-template-columns: 1fr; padding: 1.5rem 0; }
  .split, .coach, .footer-grid { grid-template-columns: 1fr; }
  .split > div:first-child { max-width: none; }
  .stack-photos { grid-template-columns: 1fr 1fr; }
  .stack-photos img { max-height: 280px; aspect-ratio: 4 / 5; }
  .nav-toggle { display: inline-flex; }
  .site-header nav {
    display: none; position: absolute; inset: 100% 0 auto 0; background: #0b0b0b;
    flex-direction: column; align-items: flex-start; padding: 1rem; border-bottom: 1px solid var(--line);
  }
  body.nav-open .site-header nav { display: flex; }
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
