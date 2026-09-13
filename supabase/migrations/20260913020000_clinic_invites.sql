-- Fase 2 — operações de clínica (ADITIVA).
-- Convites e vínculo paciente↔clínica. NÃO altera doctors/patients/bookings.
-- Pacientes atuais NÃO são migrados. clinic_patient_links fica vazia até uso pontual.

create table if not exists public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  kind text not null,
  email text not null,
  name text not null,
  crm text,
  specialty text,
  token text not null unique,
  status text not null default 'pending',
  invited_by text,
  accepted_actor_id uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists clinic_invites_clinic_idx
  on public.clinic_invites (clinic_id, status);
create index if not exists clinic_invites_email_idx
  on public.clinic_invites (lower(email), status);

create table if not exists public.clinic_patient_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_key text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create unique index if not exists clinic_patient_links_unique
  on public.clinic_patient_links (clinic_id, patient_key);

alter table public.clinic_invites enable row level security;
alter table public.clinic_patient_links enable row level security;

grant all privileges on public.clinic_invites to service_role;
grant all privileges on public.clinic_patient_links to service_role;

comment on table public.clinic_invites is
  'Convite de médico/atendente. A gestora nunca define senha.';
comment on table public.clinic_patient_links is
  'Vínculo pontual paciente↔clínica. Sem backfill dos pacientes atuais.';
