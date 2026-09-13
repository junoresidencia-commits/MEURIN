-- Fase 7 — governança de pesquisa (ADITIVA).
-- Separada do financeiro da clínica. Sem ALTER em doctors/patients/research_studies.
-- Pacientes atuais NÃO entram em estudo automaticamente.

create table if not exists public.research_protocols (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null,
  doctor_id uuid not null,
  clinic_id uuid,
  ethics_status text not null default 'none',
  protocol_code text,
  ethics_body text,
  waiver_reason text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists research_protocols_study_idx
  on public.research_protocols (study_id);
create index if not exists research_protocols_doctor_idx
  on public.research_protocols (doctor_id, ethics_status);

create table if not exists public.research_consents (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null,
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  status text not null default 'pending',
  recorded_at timestamptz not null default now()
);
create unique index if not exists research_consents_unique
  on public.research_consents (study_id, patient_key);
create index if not exists research_consents_study_idx
  on public.research_consents (study_id, status);

create table if not exists public.research_export_log (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null,
  doctor_id uuid not null,
  format text not null,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists research_export_log_study_idx
  on public.research_export_log (study_id, created_at desc);

alter table public.research_protocols enable row level security;
alter table public.research_consents enable row level security;
alter table public.research_export_log enable row level security;

grant all privileges on public.research_protocols to service_role;
grant all privileges on public.research_consents to service_role;
grant all privileges on public.research_export_log to service_role;

comment on table public.research_protocols is
  'CEP/CONEP ou dispensa por estudo. Sem isso a exportação fica bloqueada.';
comment on table public.research_consents is
  'Consentimento pontual. Sem backfill. Não lista outras clínicas.';
comment on table public.research_export_log is
  'Auditoria de exportação. Sem nome/CPF.';
