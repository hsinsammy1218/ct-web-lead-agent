# Hosting — fitness audit agent

| Piece | Host | URL / action |
| --- | --- | --- |
| Operator dashboard | **Vercel** | Project `ct-web-lead-agent` |
| Audit worker + cron | **Render** | `ct-lead-audit` + `ct-lead-maintenance` |
| Tracking DB | **Supabase** | `ytbdtfzdgncdupqzniba` |
| Generated gym sites | **Vercel** | One project per published lead |

## Vercel dashboard

Project: https://vercel.com/hsinsammy1218s-projects/ct-web-lead-agent  
Repo: `hsinsammy1218/ct-web-lead-agent` · root `apps/web` · monorepo install/build from repo root.

Required env (Production + Preview):

```
DATA_DRIVER=supabase
SUPABASE_URL=https://ytbdtfzdgncdupqzniba.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://ytbdtfzdgncdupqzniba.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable>
SUPABASE_SECRET_KEY=<service_role>
OPERATOR_EMAILS=<your email>
ALLOW_DEV_AUTH=false
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

## Render worker

Live services (EC Solutions workspace):

| Service | Schedule | Dashboard |
| --- | --- | --- |
| `ct-lead-audit` | every 5 minutes (`npm run worker:once`, Docker + Playwright) | https://dashboard.render.com/cron/crn-dbaejhm7bikc73eb26s0 |
| `ct-lead-maintenance` | daily 06:15 UTC | https://dashboard.render.com/cron/crn-dbaehsu1egvs73adjlgg |

Branch: `cursor/ct-lead-agent-0cac` (auto-deploy on push). Blueprint: `render.yaml` + `Dockerfile.worker`.

**Ignore / delete** the failed native Node cron `ct-lead-worker`
(https://dashboard.render.com/cron/crn-dbaehse7bikc73eaqdg0 → Settings → Delete).
Its build still runs `playwright install --with-deps`, which fails with `su: Authentication failure` on Render. Audits use `ct-lead-audit` (Docker) instead.

**Required on both services** (Environment → Add / edit — replace any `{{…}}` placeholders):

| Variable | Where |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API (`sb_secret_…` or legacy `service_role`) |
| `OPERATOR_EMAILS` | Your login email (comma-separated if several) |

Optional on `ct-lead-audit`: `OPENAI_API_KEY`, `PAGESPEED_API_KEY`, `GITHUB_TOKEN` (`ghp_…`), `VERCEL_TOKEN` (from https://vercel.com/account/tokens — **not** a `prj_…` project id).

Local `.env.local` is already wired and `npm run worker:once` connects to Supabase successfully. Render cron runs need the same secrets in the dashboard (or a Render API key so the agent can push them).

Re-apply or recreate from Blueprint:

https://dashboard.render.com/blueprint/new?repo=https://github.com/hsinsammy1218/ct-web-lead-agent
