-- Pesquisa Científica: estudos e casos interessantes (por médico).
-- Idempotente. Isolamento por doctor_id.

create table if not exists public.research_studies (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  type text not null default 'projeto_livre',
  title text not null default '',
  question text not null default '',
  filters jsonb not null default '[]'::jsonb,
  variables jsonb not null default '[]'::jsonb,
  journal text,
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_studies_doctor_idx on public.research_studies (doctor_id, updated_at desc);
alter table public.research_studies enable row level security;
grant all privileges on table public.research_studies to service_role;

create table if not exists public.research_cases (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  categories jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists research_cases_unique on public.research_cases (doctor_id, patient_key);
create index if not exists research_cases_doctor_idx on public.research_cases (doctor_id, updated_at desc);
alter table public.research_cases enable row level security;
grant all privileges on table public.research_cases to service_role;
