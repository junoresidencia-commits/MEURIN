-- Equipe assistencial (psicologia + enfermagem) e Diálise Peritoneal.
-- Aditivo/idempotente. Não altera tabelas de nutrição, exames, prontuário, LME, agenda ou pagamentos.

create extension if not exists pgcrypto;

create table if not exists public.allied_professionals (
  id uuid primary key default gen_random_uuid(),
  role text not null, -- 'psychology' | 'nursing'
  name text not null,
  cpf text,
  cpf_normalized text,
  email text,
  phone text,
  registry text,
  uf text,
  specialty text,
  bio text,
  photo_url text,
  password_hash text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_access_at timestamptz
);
create index if not exists allied_professionals_role_idx on public.allied_professionals (role);
create index if not exists allied_professionals_cpf_idx on public.allied_professionals (cpf_normalized);

create table if not exists public.allied_links (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  doctor_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists allied_links_unique on public.allied_links (professional_id, doctor_id);

create table if not exists public.allied_referrals (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  doctor_id uuid not null,
  doctor_name text,
  professional_id uuid not null,
  patient_key text not null,
  patient_name text,
  reason text,
  notes text,
  status text not null default 'aberto',
  created_at timestamptz not null default now()
);
create index if not exists allied_referrals_pro_idx on public.allied_referrals (professional_id);
create index if not exists allied_referrals_patient_idx on public.allied_referrals (patient_key);

create table if not exists public.allied_notes (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  kind text not null,
  professional_id uuid not null,
  professional_name text not null,
  registry text,
  patient_key text not null,
  title text,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  share_with_team boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists allied_notes_patient_idx on public.allied_notes (patient_key);

create table if not exists public.pd_profiles (
  patient_key text primary key,
  modality text,
  start_date date,
  implant_date date,
  catheter_type text,
  catheter_site text,
  caregiver text,
  center text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.pd_prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  exchanges int,
  volume_ml int,
  dwell_hours numeric,
  solution text,
  glucose_percent text,
  icodextrin boolean default false,
  total_daily_ml int,
  last_fill text,
  notes text,
  created_at timestamptz not null default now(),
  created_by text not null,
  created_by_name text
);
create index if not exists pd_prescriptions_patient_idx on public.pd_prescriptions (patient_key);

create table if not exists public.pd_daily_logs (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  logged_at timestamptz not null,
  weight_kg numeric,
  systolic int,
  diastolic int,
  urine_ml int,
  ultrafiltration_ml int,
  drained_ml int,
  balance_ml int,
  edema text,
  glucose_mg_dl numeric,
  effluent text,
  abdominal_pain boolean default false,
  fever boolean default false,
  missed_exchanges boolean default false,
  events text,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists pd_daily_logs_patient_idx on public.pd_daily_logs (patient_key);

create table if not exists public.pd_catheter_evals (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  evaluated_at date not null,
  site text,
  orifice text,
  hyperemia boolean default false,
  secretion boolean default false,
  pain boolean default false,
  crust boolean default false,
  dressing text,
  notes text,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.pd_peritonitis (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  onset_date date not null,
  symptoms text,
  cloudy_effluent boolean default false,
  abdominal_pain boolean default false,
  cell_count text,
  pmn text,
  gram text,
  culture text,
  organism text,
  antibiotic text,
  route text,
  start_date date,
  end_date date,
  clinical_response text,
  catheter_removed boolean default false,
  recurrence_kind text,
  outcome text,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.pd_adequacy (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  measured_at date not null,
  ktv numeric,
  residual_clearance numeric,
  residual_urine_ml int,
  ultrafiltration_ml int,
  pet text,
  transporter text,
  notes text,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.pd_training (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  evaluated_at date not null,
  items jsonb not null default '{}'::jsonb,
  notes text,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table public.allied_professionals enable row level security;
alter table public.allied_links enable row level security;
alter table public.allied_referrals enable row level security;
alter table public.allied_notes enable row level security;
alter table public.pd_profiles enable row level security;
alter table public.pd_prescriptions enable row level security;
alter table public.pd_daily_logs enable row level security;
alter table public.pd_catheter_evals enable row level security;
alter table public.pd_peritonitis enable row level security;
alter table public.pd_adequacy enable row level security;
alter table public.pd_training enable row level security;

grant all privileges on table public.allied_professionals to service_role;
grant all privileges on table public.allied_links to service_role;
grant all privileges on table public.allied_referrals to service_role;
grant all privileges on table public.allied_notes to service_role;
grant all privileges on table public.pd_profiles to service_role;
grant all privileges on table public.pd_prescriptions to service_role;
grant all privileges on table public.pd_daily_logs to service_role;
grant all privileges on table public.pd_catheter_evals to service_role;
grant all privileges on table public.pd_peritonitis to service_role;
grant all privileges on table public.pd_adequacy to service_role;
grant all privileges on table public.pd_training to service_role;
