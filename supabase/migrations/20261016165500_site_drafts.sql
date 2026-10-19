create table site_drafts (
  business_id uuid primary key references businesses (id) on delete cascade,
  status text not null check (status in ('queued', 'ready', 'failed')),
  path text,
  preview_path text,
  generated_at timestamptz,
  summary text,
  fixes_applied jsonb not null default '[]'::jsonb,
  recommended_service text,
  error text,
  updated_at timestamptz not null default now()
);

alter table site_drafts enable row level security;

grant select on site_drafts to authenticated;

create policy operator_read_site_drafts on site_drafts
  for select to authenticated
  using (public.is_operator());
