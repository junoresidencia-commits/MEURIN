-- Hemodiálise (ADITIVO).
-- Não altera doctors, patients, bookings, documents, agenda, financeiro nem prontuário.

create table if not exists public.hd_units (
  id uuid primary key default gen_random_uuid(),
  owner_doctor_id text not null,
  name text not null default 'Hemodiálise',
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hd_units_owner_idx on public.hd_units (owner_doctor_id);

create table if not exists public.hd_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.hd_units(id),
  doctor_id text,
  email text not null,
  name text not null,
  role text not null,
  function_label text not null default '',
  status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hd_members_unit_idx on public.hd_members (unit_id, status);
create index if not exists hd_members_email_idx on public.hd_members (email);

create table if not exists public.hd_patients (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.hd_units(id),
  patient_id text,
  name text not null,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hd_patients_unit_idx on public.hd_patients (unit_id, name);

create table if not exists public.hd_machines (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.hd_units(id),
  number text not null,
  ward text not null,
  active boolean not null default true
);

create table if not exists public.hd_months (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.hd_units(id),
  year integer not null,
  month integer not null,
  status text not null default 'open',
  closed_at timestamptz,
  closed_by text,
  closed_by_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists hd_months_unit_ym_idx on public.hd_months (unit_id, year, month);

create table if not exists public.hd_map_rows (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  month_id uuid not null,
  patient_id uuid not null,
  shift text not null,
  weekday_group text not null,
  ward text not null default '',
  machine text not null default '',
  access text not null default '',
  heparin text not null default '',
  time text not null default '',
  capillary text not null default '',
  epo text not null default '',
  iron text not null default '',
  sevelamer text not null default '',
  calcitriol text not null default '',
  cinacalcet text not null default '',
  paricalcitol text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists hd_map_rows_month_idx on public.hd_map_rows (month_id, shift, machine);

create table if not exists public.hd_lab_results (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  month_id uuid not null,
  patient_id uuid not null,
  exam_code text not null,
  value numeric,
  raw_value text not null default '',
  unit text not null default '',
  collected_at text,
  confidence numeric not null default 100,
  source text not null,
  status text not null,
  file_id uuid,
  created_by text not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  confirmed_by text,
  confirmed_at timestamptz
);
create index if not exists hd_lab_results_month_idx on public.hd_lab_results (month_id, patient_id, exam_code);

create table if not exists public.hd_lab_files (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  month_id uuid,
  name text not null,
  mime text not null,
  path text not null,
  storage text not null,
  uploaded_by text not null,
  uploaded_by_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hd_prescriptions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  month_id uuid not null,
  patient_id uuid not null,
  epo text not null default '',
  iron text not null default '',
  sevelamer text not null default '',
  calcitriol text not null default '',
  cinacalcet text not null default '',
  paricalcitol text not null default '',
  heparin text not null default '',
  time text not null default '',
  capillary text not null default '',
  access text not null default '',
  status text not null default 'approved',
  updated_at timestamptz not null default now()
);

create table if not exists public.hd_reviews (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  month_id uuid not null,
  patient_id uuid not null,
  decision text not null,
  situation text not null default '',
  suggestion text not null default '',
  notes text not null default '',
  protocol_codes jsonb not null default '[]'::jsonb,
  reviewed_by text not null,
  reviewed_by_name text not null,
  reviewed_at timestamptz not null default now()
);

create table if not exists public.hd_rules (
  id text primary key,
  code text not null,
  domain text not null,
  version text not null,
  source text not null,
  date text not null,
  params jsonb not null default '{}'::jsonb,
  condition text not null,
  classification text not null,
  suggestion text not null,
  active boolean not null default true
);

create table if not exists public.hd_audit_logs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  actor_id text not null,
  actor_name text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  before text,
  after text,
  justification text,
  protocol text,
  created_at timestamptz not null default now()
);
create index if not exists hd_audit_logs_unit_idx on public.hd_audit_logs (unit_id, created_at desc);

create table if not exists public.hd_settings (
  unit_id uuid primary key references public.hd_units(id),
  expected_exams jsonb not null default '[]'::jsonb,
  center_name text not null default 'Hemodiálise',
  updated_at timestamptz not null default now()
);
