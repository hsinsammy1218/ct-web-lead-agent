# Supabase setup — CT fitness audit agent

The audit agent persists leads, audits, scores, work queue jobs, and generated site drafts in Supabase so tracking survives across worker runs and dashboard sessions.

## Project

| Field | Value |
| --- | --- |
| Name | `ct-web-lead-agent` |
| Project ref | `ytbdtfzdgncdupqzniba` |
| Region | `us-east-1` |
| API URL | `https://ytbdtfzdgncdupqzniba.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/ytbdtfzdgncdupqzniba |

Schema applied from `supabase/migrations/` (leads, websites, audits, findings, scores, notes, work queue, site drafts). Reference data seeded: **9** planning regions, **169** CT municipalities, **9** fitness industries.

## What gets tracked

| Table | Purpose |
| --- | --- |
| `businesses` / `business_websites` | Submitted fitness leads and URLs |
| `website_audits` / `audit_findings` | Measured audit results |
| `lead_scores` / `ai_assessments` | Opportunity scoring |
| `work_items` | Worker job queue (audit → score → generate → publish) |
| `site_drafts` | Generated fitness site + GitHub/Vercel publish status |
| `lead_notes` / `lead_status_history` | Operator CRM notes |

## Env vars

Set these for the web app and worker (`DATA_DRIVER=supabase`):

```bash
DATA_DRIVER=supabase
SUPABASE_URL=https://ytbdtfzdgncdupqzniba.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://ytbdtfzdgncdupqzniba.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key>
SUPABASE_SECRET_KEY=<service_role secret — server only>
OPERATOR_EMAILS=you@example.com
ALLOW_DEV_AUTH=false
```

1. Open **Project Settings → API Keys**.
2. Copy the **publishable** (or legacy anon) key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Copy the **service_role** / secret key into `SUPABASE_SECRET_KEY` (never commit this; never prefix with `NEXT_PUBLIC_`).
4. Put the same URL + secret on the Render worker and Vercel dashboard.

## Operator auth

Magic-link email. First allowlisted sign-in sets `app_metadata.role = operator`. RLS policies require that role for dashboard reads/writes. The worker uses the secret key and bypasses RLS for audits and job claims.

### Fix “redirect_to=http://localhost:3000” in the email

The confirm link uses Supabase **Authentication → URL Configuration**:

1. **Site URL** → `https://ct-web-lead-agent.vercel.app` (not `http://localhost:3000`)
2. **Redirect URLs** → add:
   - `https://ct-web-lead-agent.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (optional, for local)
3. On Vercel, set `NEXT_PUBLIC_SITE_URL=https://ct-web-lead-agent.vercel.app` (Production + Preview), then redeploy
4. Request a **new** magic link — old emails still point at localhost

Dashboard: https://supabase.com/dashboard/project/ytbdtfzdgncdupqzniba/auth/url-configuration

## Local verify

```bash
# after secrets are in .env.local
DATA_DRIVER=supabase npm run worker:once
```

The worker reseeds industries/towns on startup via `seedReference()`.
