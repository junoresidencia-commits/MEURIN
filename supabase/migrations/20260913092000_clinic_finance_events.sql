-- Histórico financeiro da clínica (ADITIVO). Staging primeiro.
-- Não altera doctors, patients, bookings nem prontuário.

create table if not exists public.clinic_finance_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  kind text not null,
  entity text not null,
  entity_id text not null,
  before_cents integer,
  after_cents integer,
  reason text,
  actor_kind text,
  actor_id text,
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists clinic_finance_events_clinic_idx
  on public.clinic_finance_events (clinic_id, created_at desc);

alter table public.clinic_finance_events enable row level security;
grant all privileges on public.clinic_finance_events to service_role;

comment on table public.clinic_finance_events is
  'Histórico de regra, check-in, fechamento e repasse. Não apaga o valor anterior.';
