-- Rede de profissionais: encaminhamentos com consentimento, vínculos e perfil público.
-- Aditivo/idempotente. Sem dados clínicos no registro — só metadados do encaminhamento.

create extension if not exists pgcrypto;

alter table public.patients alter column doctor_id drop not null;

alter table public.doctors add column if not exists professional_name text;
alter table public.doctors add column if not exists profession text;
alter table public.doctors add column if not exists city text;
alter table public.doctors add column if not exists state text;

create table if not exists public.patient_network_referrals (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  patient_name text,
  registered_by_kind text,
  registered_by_id text,
  registered_by_name text,
  from_kind text not null,
  from_id text not null,
  from_name text,
  from_profession text,
  from_specialty text,
  to_kind text not null,
  to_id text not null,
  to_name text,
  to_profession text,
  to_specialty text,
  reason text,
  notes text,
  status text not null default 'pending',
  share_slices jsonb not null default '["reason","clinicalSummary"]'::jsonb,
  consent_confirmed boolean not null default false,
  consent_method text,
  consent_at timestamptz,
  consent_by_kind text,
  consent_by_id text,
  consent_by_name text,
  consent_revoked_at timestamptz,
  share_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  viewed_at timestamptz,
  accepted_at timestamptz,
  finished_at timestamptz
);
create index if not exists patient_network_referrals_to_idx
  on public.patient_network_referrals (to_kind, to_id, status);
create index if not exists patient_network_referrals_from_idx
  on public.patient_network_referrals (from_kind, from_id, status);
create index if not exists patient_network_referrals_patient_idx
  on public.patient_network_referrals (patient_key, created_at desc);

create table if not exists public.patient_network_referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null,
  action text not null,
  actor_kind text,
  actor_id text,
  actor_name text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists patient_network_referral_events_ref_idx
  on public.patient_network_referral_events (referral_id, created_at);

create table if not exists public.patient_professional_links (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  patient_name text,
  professional_kind text not null,
  professional_id text not null,
  origin text not null default 'followup',
  referral_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists patient_professional_links_unique
  on public.patient_professional_links (patient_key, professional_kind, professional_id);

alter table public.patient_network_referrals enable row level security;
alter table public.patient_network_referral_events enable row level security;
alter table public.patient_professional_links enable row level security;

grant all privileges on public.patient_network_referrals to service_role;
grant all privileges on public.patient_network_referral_events to service_role;
grant all privileges on public.patient_professional_links to service_role;

comment on table public.patient_network_referrals is
  'Encaminhamento entre profissionais da rede Meu Rim, com consentimento e fatias compartilhadas. Não duplica o cadastro do paciente.';
