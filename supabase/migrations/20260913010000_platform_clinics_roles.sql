-- Fundação multiclinica (ADITIVA).
-- Cria tabelas novas. NÃO altera doctors, patients, bookings, clinical_notes,
-- documents, lab_results nem IDs existentes.
-- Pacientes atuais continuam acessíveis só pelo doctor_id (fallback).

create extension if not exists pgcrypto;

create table if not exists public.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  actor_kind text not null,
  actor_id uuid not null,
  role text not null,
  granted_by text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists platform_role_assignments_unique
  on public.platform_role_assignments (actor_kind, actor_id, role)
  where revoked_at is null;
create index if not exists platform_role_assignments_actor_idx
  on public.platform_role_assignments (actor_kind, actor_id);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cnpj text,
  city text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  actor_kind text not null,
  actor_id uuid not null,
  role text not null,
  status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clinic_memberships_unique
  on public.clinic_memberships (clinic_id, actor_kind, actor_id, role)
  where status = 'active';
create index if not exists clinic_memberships_actor_idx
  on public.clinic_memberships (actor_kind, actor_id, status);
create index if not exists clinic_memberships_clinic_idx
  on public.clinic_memberships (clinic_id, status);

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_kind text,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);

create table if not exists public.platform_integrity_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  counts jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.platform_role_assignments enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.platform_audit_log enable row level security;
alter table public.platform_integrity_snapshots enable row level security;

grant all privileges on public.platform_role_assignments to service_role;
grant all privileges on public.clinics to service_role;
grant all privileges on public.clinic_memberships to service_role;
grant all privileges on public.platform_audit_log to service_role;
grant all privileges on public.platform_integrity_snapshots to service_role;

comment on table public.platform_role_assignments is
  'Papéis extras no usuário já existente. Nunca cria um segundo Dr. Juno.';
comment on table public.clinic_memberships is
  'Um médico, vários vínculos. Sem duplicar usuário por clínica.';
