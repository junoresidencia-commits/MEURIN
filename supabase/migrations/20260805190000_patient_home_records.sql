-- Fase 2 — Área do paciente: registro domiciliar + diário alimentar.
-- Acesso apenas server-side (chave service_role). RLS habilitado sem policies
-- públicas; o servidor grava/lê usando a service key.

create table if not exists public.home_records (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  kind text not null check (kind in ('bp', 'glucose', 'weight', 'symptom')),
  systolic integer,
  diastolic integer,
  heart_rate integer,
  glucose_mg_dl integer,
  glucose_context text,
  weight_kg numeric(6, 2),
  arm text,
  body_position text,
  med_context text,
  symptoms text,
  note text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.home_food_logs (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  food text not null,
  meal text,
  quantity text,
  note text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists home_records_email_kind_idx
  on public.home_records (patient_email, kind, measured_at desc);
create index if not exists home_food_logs_email_idx
  on public.home_food_logs (patient_email, logged_at desc);

alter table public.home_records enable row level security;
alter table public.home_food_logs enable row level security;

-- Permissões para a chave secreta (service_role) acessar as novas tabelas.
grant all privileges on public.home_records to service_role;
grant all privileges on public.home_food_logs to service_role;

comment on table public.home_records is 'Registros domiciliares do paciente (pressão, glicemia, peso, sintomas).';
comment on table public.home_food_logs is 'Diário alimentar do paciente.';
