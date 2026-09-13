-- Fase 4 — fechamento da clínica (ADITIVO).
-- Código único MED-AAAA-######. Sem ALTER em doctors/patients/bookings.

create table if not exists public.clinic_closings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  doctor_id uuid not null,
  code text not null unique,
  period_from date not null,
  period_to date not null,
  encounter_ids jsonb not null default '[]'::jsonb,
  produced_cents integer not null default 0,
  received_cents integer not null default 0,
  clinic_share_cents integer not null default 0,
  doctor_share_cents integer not null default 0,
  status text not null default 'closed',
  created_by text,
  paid_at timestamptz,
  paid_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_closings_clinic_idx
  on public.clinic_closings (clinic_id, created_at desc);
create index if not exists clinic_closings_doctor_idx
  on public.clinic_closings (doctor_id, period_from, period_to);

create table if not exists public.clinic_closing_adjustments (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.clinic_closings(id),
  clinic_id uuid not null references public.clinics(id),
  kind text not null,
  amount_cents integer not null,
  reason text not null,
  created_by_kind text,
  created_by_id uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists clinic_closing_adjustments_closing_idx
  on public.clinic_closing_adjustments (closing_id, created_at desc);

alter table public.clinic_closings enable row level security;
alter table public.clinic_closing_adjustments enable row level security;

grant all privileges on public.clinic_closings to service_role;
grant all privileges on public.clinic_closing_adjustments to service_role;

comment on table public.clinic_closings is
  'Fechamento por médico e período. Código único MED-AAAA-######.';
comment on table public.clinic_closing_adjustments is
  'Ajuste auditado do fechamento. Motivo obrigatório. Não apaga o original.';
