# CT Web Lead Agent

Internal tool for auditing websites an operator has already found in Connecticut. The operator submits a URL, business name, municipality, and industry. A worker fetches that URL, records evidence, and scores the opportunity.

This release does not search Google, Yelp, Overture, or the state business registry.

## Local development

Requirements: Node.js 22.

```bash
cp .env.example .env.local
npm install
npm test
npm run dev
```

Open http://localhost:3000 — there is no operator sign-in. With `DATA_DRIVER=file`, leads are stored in `data/local-store.json`.

In another terminal:

```bash
npm run worker:once
```

That drains the queue, including score, website generation, and publish jobs. After scoring, the worker:

1. Builds a final **multi-page fitness website** under `data/drafts/<lead-id>/` (gyms, boxing, studios, training)
   - **Update:** rebuild from the audited site’s content and media when a real operator site exists
   - **New site:** replace social/directory/blocked/unreachable leads with a new official gym site (Home / Classes / About / Book)
2. Creates a private GitHub repo for that site (when `GITHUB_TOKEN` and `SITE_GITHUB_OWNER` are set)
3. Deploys it to Vercel (when `VERCEL_TOKEN` is set)
4. Runs production checks on the HTML and live URL

See [docs/site-generation-playbook.md](docs/site-generation-playbook.md) for the fitness update vs new-site rules.

The lead page links to the local preview, GitHub repo, and live Vercel URL. Leave `PLAYWRIGHT_ENABLED=false` unless Chromium is installed. PageSpeed and OpenAI run only when their keys are set.

## Production

- Dashboard: Next.js on Vercel. Set `DATA_DRIVER=supabase` and the Supabase URL, publishable key, and secret key. The secret key is server-only.
- Database: project `ct-web-lead-agent` (`ytbdtfzdgncdupqzniba`). Schema is in `supabase/migrations`; see [docs/supabase-setup.md](docs/supabase-setup.md). The worker reseeds the 169 municipalities and fitness industries on startup.
- Auth: none. The dashboard is open; submissions are attributed to the first address in `OPERATOR_EMAILS` when set.
- Worker: `render.yaml` runs the audit poll cron (Playwright) and a daily maintenance cron for re-audits and screenshot retention.

## Scores

Quality is a weighted mean of measured components. Need is not `100 - quality`. Opportunity is null when need is null, including blocked and unreachable fetches. Social and directory URLs are classified and are not given a website quality score.
