-- CT Web Lead Agent: operator-submitted websites, audits, and scores.
-- Service-role writes audits. Operators read, submit, and annotate.

create extension if not exists pgcrypto;

create table planning_regions (
  id text primary key,
  name text not null,
  cog_name text not null,
  fips text
);

create table municipalities (
  id uuid primary key default gen_random_uuid(),
  opm_code text not null unique,
  name text not null,
  name_normalized text not null unique,
  planning_region_id text not null references planning_regions (id),
  legacy_county text
);

create table industries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  name_normalized text not null,
  industry_id uuid not null references industries (id),
  municipality_id uuid not null references municipalities (id),
  lead_status text not null default 'new' check (lead_status in ('new', 'review', 'qualified', 'contacted', 'not_a_fit', 'closed')),
  phone text,
  submitted_by uuid,
  created_at timestamptz not null default now()
);

create table business_websites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses (id) on delete cascade,
  original_url text not null,
  final_url text,
  registrable_domain text not null,
  status text not null,
  name_mention_warning boolean not null default false,
  allow_duplicate boolean not null default false,
  fetched_at timestamptz
);

create unique index business_websites_domain_active
  on business_websites (registrable_domain)
  where allow_duplicate = false;

create table business_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind text not null,
  value text not null,
  provenance text not null check (provenance in ('operator', 'page_extract')),
  confidence numeric,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses (id) on delete set null,
  raw jsonb not null,
  result text not null,
  message text,
  created_at timestamptz not null default now()
);

create table website_audits (
  id uuid primary key default gen_random_uuid(),
  business_website_id uuid not null references business_websites (id) on delete cascade,
  status text not null check (status in ('queued', 'completed', 'failed', 'blocked', 'skipped')),
  summary text,
  performance_score numeric,
  mobile_score numeric,
  seo_score numeric,
  ux_score numeric,
  technical_score numeric,
  design_score numeric,
  quality_score numeric,
  html_sha256 text,
  screenshot_path text,
  audited_at timestamptz,
  created_at timestamptz not null default now()
);

create index website_audits_website_time on website_audits (business_website_id, audited_at desc);

create table audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references website_audits (id) on delete cascade,
  category text not null,
  code text not null,
  severity text not null,
  evidence jsonb not null default '{}'::jsonb,
  source text not null check (source in ('measured', 'inferred'))
);

create table ai_assessments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  audit_id uuid references website_audits (id) on delete set null,
  model text not null,
  schema_version text not null,
  input_hash text not null unique,
  output jsonb not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table lead_scores (
  business_id uuid primary key references businesses (id) on delete cascade,
  quality numeric,
  need numeric,
  qualification numeric not null,
  contact numeric not null,
  confidence numeric not null,
  opportunity numeric,
  band text,
  recommended_service text,
  explanation jsonb not null,
  model_version text not null,
  updated_at timestamptz not null default now()
);

create table lead_score_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  explanation jsonb not null,
  created_at timestamptz not null default now()
);

create table lead_status_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  status text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table work_items (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempt integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_items_ready on work_items (status, run_after);

create table api_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  quantity integer not null,
  estimated_cost_usd numeric not null,
  occurred_at timestamptz not null default now()
);

create table system_settings (
  key text primary key,
  value jsonb not null
);

insert into system_settings (key, value) values
  ('reaudit_days', '90'),
  ('monthly_api_cap_usd', '50'),
  ('daily_api_cap_usd', '5'),
  ('ai_quality_threshold', '70'),
  ('screenshot_retention_days', '90');

create or replace function public.is_operator()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'operator';
$$;

create or replace function public.claim_work_item()
returns work_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed work_items;
begin
  update work_items
  set status = 'running',
      attempt = attempt + 1,
      locked_until = now() + interval '10 minutes',
      updated_at = now()
  where id = (
    select id from work_items
    where status = 'queued'
      and run_after <= now()
      and attempt < max_attempts
    order by created_at
    for update skip locked
    limit 1
  )
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.is_operator() from public;
revoke all on function public.claim_work_item() from public;
grant execute on function public.is_operator() to authenticated;
grant execute on function public.claim_work_item() to service_role;

alter table planning_regions enable row level security;
alter table municipalities enable row level security;
alter table industries enable row level security;
alter table businesses enable row level security;
alter table business_websites enable row level security;
alter table business_contacts enable row level security;
alter table submissions enable row level security;
alter table website_audits enable row level security;
alter table audit_findings enable row level security;
alter table ai_assessments enable row level security;
alter table lead_scores enable row level security;
alter table lead_score_history enable row level security;
alter table lead_status_history enable row level security;
alter table lead_notes enable row level security;
alter table work_items enable row level security;
alter table api_usage_ledger enable row level security;
alter table system_settings enable row level security;

grant select on planning_regions, municipalities, industries, businesses, business_websites, business_contacts, submissions, website_audits, audit_findings, ai_assessments, lead_scores, lead_score_history, lead_status_history, lead_notes, work_items, api_usage_ledger, system_settings to authenticated;
grant insert on businesses, business_websites, business_contacts, submissions, lead_notes, lead_status_history, work_items to authenticated;
grant update on businesses, lead_notes to authenticated;

create policy operator_read_planning_regions on planning_regions for select to authenticated using (public.is_operator());
create policy operator_read_municipalities on municipalities for select to authenticated using (public.is_operator());
create policy operator_read_industries on industries for select to authenticated using (public.is_operator());
create policy operator_read_businesses on businesses for select to authenticated using (public.is_operator());
create policy operator_insert_businesses on businesses for insert to authenticated with check (public.is_operator());
create policy operator_update_businesses on businesses for update to authenticated using (public.is_operator()) with check (public.is_operator());
create policy operator_read_websites on business_websites for select to authenticated using (public.is_operator());
create policy operator_insert_websites on business_websites for insert to authenticated with check (public.is_operator());
create policy operator_read_contacts on business_contacts for select to authenticated using (public.is_operator());
create policy operator_insert_contacts on business_contacts for insert to authenticated with check (public.is_operator());
create policy operator_read_submissions on submissions for select to authenticated using (public.is_operator());
create policy operator_insert_submissions on submissions for insert to authenticated with check (public.is_operator());
create policy operator_read_audits on website_audits for select to authenticated using (public.is_operator());
create policy operator_read_findings on audit_findings for select to authenticated using (public.is_operator());
create policy operator_read_ai on ai_assessments for select to authenticated using (public.is_operator());
create policy operator_read_scores on lead_scores for select to authenticated using (public.is_operator());
create policy operator_read_score_history on lead_score_history for select to authenticated using (public.is_operator());
create policy operator_read_status_history on lead_status_history for select to authenticated using (public.is_operator());
create policy operator_insert_status_history on lead_status_history for insert to authenticated with check (public.is_operator());
create policy operator_read_notes on lead_notes for select to authenticated using (public.is_operator());
create policy operator_insert_notes on lead_notes for insert to authenticated with check (public.is_operator());
create policy operator_update_notes on lead_notes for update to authenticated using (public.is_operator()) with check (public.is_operator());
create policy operator_read_work on work_items for select to authenticated using (public.is_operator());
create policy operator_insert_work on work_items for insert to authenticated with check (public.is_operator());
create policy operator_read_usage on api_usage_ledger for select to authenticated using (public.is_operator());
create policy operator_read_settings on system_settings for select to authenticated using (public.is_operator());
