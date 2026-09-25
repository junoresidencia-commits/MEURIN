-- Calculadoras & Risco (ADITIVO).
-- Não altera patients, labs, clinical_profiles, bookings, documents, LME nem hemodiálise.

create table if not exists public.calc_tool_catalog (
  id text primary key,
  section text not null,
  title text not null,
  version text not null,
  published text not null default '',
  reviewed_at date,
  source text not null default '',
  population text not null default '',
  formula text not null default '',
  limitations text not null default '',
  official_url text,
  license_note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.calc_results (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null,
  patient_key text,
  tool_id text not null,
  status text not null,
  headline text not null default '',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists calc_results_patient_idx on public.calc_results (doctor_id, patient_key, tool_id, created_at desc);
create index if not exists calc_results_tool_idx on public.calc_results (tool_id, created_at desc);

create table if not exists public.calc_assessments (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null,
  patient_key text not null,
  tool_id text not null,
  payload jsonb not null default '{}'::jsonb,
  assessed_by text,
  context text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists calc_assessments_patient_idx on public.calc_assessments (doctor_id, patient_key, tool_id, created_at desc);

create table if not exists public.calc_decisions (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null,
  patient_key text not null,
  tool_id text not null,
  item text not null default '',
  rule text not null default '',
  decision text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists calc_decisions_patient_idx on public.calc_decisions (doctor_id, patient_key, created_at desc);
