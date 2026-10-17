-- Extend site drafts with GitHub/Vercel publish metadata and test results.

alter table site_drafts
  drop constraint if exists site_drafts_status_check;

alter table site_drafts
  add constraint site_drafts_status_check
  check (status in ('queued', 'ready', 'failed', 'publishing'));

alter table site_drafts
  add column if not exists repo_url text,
  add column if not exists deployment_url text,
  add column if not exists github_repo text,
  add column if not exists vercel_project_id text,
  add column if not exists publish_status text,
  add column if not exists tests_passed boolean,
  add column if not exists test_checks jsonb not null default '[]'::jsonb;
