# Site generation playbook

After every website audit, the worker must deliver a **production-ready multi-page professional site** for that business — not a single-page placeholder.

## When it is an update

Use this path when the lead has a real operator/platform site we can read (`OPERATOR_SITE` / `PLATFORM_SITE`, recommended service redesign or local SEO).

1. Reuse the audited HTML (saved under `data/audit-html/`) or re-fetch the live URL.
2. Extract brand signals: title, description, headings, paragraphs, images, phone, email, social links.
3. Rebuild a complete site that keeps **their** content and photography where possible.
4. Always publish at least: `index.html`, `services.html`, `about.html`, `contact.html`, `styles.css`.
5. Ship SEO basics: unique titles/descriptions, one H1, LocalBusiness schema, click-to-call/contact form.
6. Push to a private GitHub repo and deploy to Vercel; run production checks on HTML and the live URL.

Flagship / high-touch accounts (for example In Your Corner Boxing) may use a curated source rebuild with extra domain pages (coaches, schedule, programs). That is still an “update,” just with a specialty template.

## When it is a new website

Use this path when the submitted URL is social-only, directory-only, blocked, unreachable, or the score recommends `new_site`.

1. Build a new official multi-page site from the lead intake (name, town, industry, phone) plus industry defaults.
2. Same page set as updates: Home, Services, About, Contact.
3. Do not pretend the social/directory page was the company website — replace it.
4. Publish and verify the same way as updates.

## Quality bar (what “like IYC” means)

- Feels like a real business site, not an audit report or template demo.
- Multi-page information architecture with clear nav and CTAs.
- Real contact paths and local Connecticut context.
- Source-faithful when content exists; invented stock copy only when there is no usable source site.
- Deployed URL linked on the lead after checks pass.

## Code map

| Piece | Role |
| --- | --- |
| `packages/core/src/site-draft.ts` | Entry point after scoring |
| `packages/core/src/site-professional.ts` | Default multi-page builder (update + new) |
| `packages/core/src/site-extract.ts` | Pull content/media from audited HTML |
| `packages/core/src/site-from-source.ts` | Curated specialty rebuilds |
| `apps/worker/src/pipeline.ts` | Saves audit HTML, generates, publishes |
