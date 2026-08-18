-- ============================================================================
-- Módulo Nutrição Renal — Fase 1 (aditivo/idempotente, não altera dados existentes)
-- ============================================================================
create extension if not exists pgcrypto;

-- Nutricionistas (perfil profissional próprio; login por CPF/e-mail + senha)
create table if not exists public.nutritionists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text,
  cpf_normalized text,
  email text,
  phone text,
  crn text,
  uf text,
  specialty text,
  bio text,
  password_hash text,
  signature_url text,
  status text not null default 'active', -- 'active' | 'inactive'
  created_at timestamptz not null default now(),
  last_access_at timestamptz
);
create index if not exists nutritionists_cpf_norm_idx on public.nutritionists (cpf_normalized);

-- Vínculo nutricionista <-> médico (dá acesso clínico aos pacientes daquele médico)
create table if not exists public.nutritionist_links (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null,
  doctor_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists nutritionist_links_unique on public.nutritionist_links (nutritionist_id, doctor_id);

-- Encaminhamentos do médico para a nutrição
create table if not exists public.nutrition_referrals (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  doctor_name text,
  nutritionist_id uuid,
  patient_key text not null,
  patient_name text,
  reason text,
  objective text,
  restrictions text,
  priority text not null default 'normal', -- 'normal' | 'alta'
  notes text,
  status text not null default 'aberto', -- 'aberto' | 'atendido'
  created_at timestamptz not null default now()
);
create index if not exists nutrition_referrals_doctor_idx on public.nutrition_referrals (doctor_id);
create index if not exists nutrition_referrals_patient_idx on public.nutrition_referrals (patient_key);

-- Consultas nutricionais (avaliação + plano alimentar estruturados)
create table if not exists public.nutrition_consultations (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null,
  nutritionist_name text,
  doctor_id uuid,
  patient_key text not null,
  patient_name text,
  assessment jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  shared_with_patient boolean not null default false,
  document_id text,
  created_at timestamptz not null default now()
);
create index if not exists nutrition_consultations_patient_idx on public.nutrition_consultations (patient_key);

alter table public.nutritionists enable row level security;
alter table public.nutritionist_links enable row level security;
alter table public.nutrition_referrals enable row level security;
alter table public.nutrition_consultations enable row level security;
grant all privileges on table public.nutritionists to service_role;
grant all privileges on table public.nutritionist_links to service_role;
grant all privileges on table public.nutrition_referrals to service_role;
grant all privileges on table public.nutrition_consultations to service_role;
