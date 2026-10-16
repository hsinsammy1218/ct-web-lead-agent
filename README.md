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

Sign in with `operator@example.com` while `ALLOW_DEV_AUTH=true` and `DATA_DRIVER=file`. Leads are stored in `data/local-store.json`.

In another terminal:

```bash
npm run worker:once
```

That drains the queue, including score, draft generation, and publish jobs. After scoring, the worker:

1. Writes a fixed homepage under `data/drafts/<lead-id>/`
2. Creates a private GitHub repo for that site (when `GITHUB_TOKEN` and `SITE_GITHUB_OWNER` are set)
3. Deploys it to Vercel (when `VERCEL_TOKEN` is set)
4. Runs production checks on the HTML and live URL

The lead page links to the local draft, GitHub repo, and live Vercel URL. Leave `PLAYWRIGHT_ENABLED=false` unless Chromium is installed. PageSpeed and OpenAI run only when their keys are set.

## Production

- Dashboard: Next.js on Vercel. Set `DATA_DRIVER=supabase` and the Supabase URL, publishable key, and secret key. The secret key is server-only.
- Database: apply `supabase/migrations`. The worker seeds the 169 municipalities and industries on startup.
- Auth: magic-link email. `OPERATOR_EMAILS` is the allowlist. The first sign-in sets `app_metadata.role` to `operator`.
- Worker: `render.yaml` runs one standard worker (Playwright) and a daily maintenance cron for re-audits and screenshot retention.

## Scores

Quality is a weighted mean of measured components. Need is not `100 - quality`. Opportunity is null when need is null, including blocked and unreachable fetches. Social and directory URLs are classified and are not given a website quality score.
