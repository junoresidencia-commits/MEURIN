-- Medicamentos do paciente + adesão diária. Aditivo e idempotente (não altera nada existente).
create table if not exists public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  doctor_id text,
  name text not null,
  dose text,
  quantity text,
  frequency text,
  times jsonb not null default '[]'::jsonb,
  guidance text,
  notes text,
  source text not null default 'patient',            -- 'patient' | 'doctor'
  confirmed_by_doctor boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by text,
  status text not null default 'active',              -- 'active' | 'suspended'
  suspended_at timestamptz,
  suspended_by text,
  suspend_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patient_medications_key_idx on public.patient_medications (patient_key);

create table if not exists public.medication_adherence_log (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  patient_key text not null,
  dose_date text not null,                            -- YYYY-MM-DD
  dose_time text not null,                            -- HH:MM
  status text not null,                               -- 'taken' | 'missed'
  reason text,
  reason_text text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (medication_id, dose_date, dose_time)
);
create index if not exists medication_adherence_key_date_idx on public.medication_adherence_log (patient_key, dose_date);

alter table public.patient_medications enable row level security;
alter table public.medication_adherence_log enable row level security;
grant all privileges on table public.patient_medications to service_role;
grant all privileges on table public.medication_adherence_log to service_role;
