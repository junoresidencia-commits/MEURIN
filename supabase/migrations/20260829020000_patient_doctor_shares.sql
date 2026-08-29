-- Compartilhamento de paciente entre médicos da plataforma.
-- Aditivo/idempotente. Não altera exames, LME, agenda, financeiro nem prontuário existente.

create extension if not exists pgcrypto;

create table if not exists public.patient_doctor_shares (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  patient_name text,
  from_doctor_id uuid not null,
  from_doctor_name text,
  from_specialty text,
  to_doctor_id uuid not null,
  to_doctor_name text,
  to_specialty text,
  reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid
);
create index if not exists patient_doctor_shares_to_idx on public.patient_doctor_shares (to_doctor_id, status);
create index if not exists patient_doctor_shares_from_idx on public.patient_doctor_shares (from_doctor_id, status);
create index if not exists patient_doctor_shares_key_idx on public.patient_doctor_shares (patient_key, status);

create table if not exists public.doctor_peers (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  peer_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists doctor_peers_unique on public.doctor_peers (doctor_id, peer_id);

create table if not exists public.chart_audit_log (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  doctor_name text,
  patient_key text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists chart_audit_log_patient_idx on public.chart_audit_log (patient_key, created_at desc);

alter table public.clinical_notes add column if not exists doctor_specialty text;

alter table public.patient_doctor_shares enable row level security;
alter table public.doctor_peers enable row level security;
alter table public.chart_audit_log enable row level security;

grant all privileges on public.patient_doctor_shares to service_role;
grant all privileges on public.doctor_peers to service_role;
grant all privileges on public.chart_audit_log to service_role;

comment on table public.patient_doctor_shares is 'Vínculo paciente ↔ médico autorizado (prontuário único, sem duplicar cadastro).';
