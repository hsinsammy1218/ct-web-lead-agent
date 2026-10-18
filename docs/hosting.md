# Hosting — fitness audit agent

| Piece | Host | URL / action |
| --- | --- | --- |
| Operator dashboard | **Vercel** | Project `ct-web-lead-agent` |
| Audit worker + cron | **Render** | `ct-lead-worker` + `ct-lead-maintenance` |
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
| `ct-lead-worker` | every 5 minutes (`npm run worker:once`) | https://dashboard.render.com/cron/crn-dbaehse7bikc73eaqdg0 |
| `ct-lead-maintenance` | daily 06:15 UTC | https://dashboard.render.com/cron/crn-dbaehsu1egvs73adjlgg |

Branch: `cursor/ct-lead-agent-0cac` (auto-deploy on push). Blueprint: `render.yaml`.

**Required secret on both services** (Environment → Add):

```
SUPABASE_SECRET_KEY=<service_role from Supabase → Project Settings → API>
```

Optional: `OPERATOR_EMAILS`, `PAGESPEED_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `VERCEL_TOKEN`.

Without `SUPABASE_SECRET_KEY`, cron runs start then exit with a missing-key error. Dashboard submits still land in Supabase `work_items`; audits stay queued until the secret is set and a worker run succeeds.

Re-apply or recreate from Blueprint:

https://dashboard.render.com/blueprint/new?repo=https://github.com/hsinsammy1218/ct-web-lead-agent
