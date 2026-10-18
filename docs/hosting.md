# Hosting — fitness audit agent

| Piece | Host | URL / action |
| --- | --- | --- |
| Operator dashboard | **Vercel** | Project `ct-web-lead-agent` |
| Audit worker + cron | **Render** | Blueprint in `render.yaml` |
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

Apply the Blueprint (must be on the default branch GitHub can read):

https://dashboard.render.com/blueprint/new?repo=https://github.com/hsinsammy1218/ct-web-lead-agent

When prompted, set secrets: `SUPABASE_SECRET_KEY`, `OPERATOR_EMAILS`, and optionally `PAGESPEED_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `VERCEL_TOKEN`.

Without the Render worker, the Vercel dashboard can submit leads into Supabase, but audits will sit in `work_items` until a worker claims them.
