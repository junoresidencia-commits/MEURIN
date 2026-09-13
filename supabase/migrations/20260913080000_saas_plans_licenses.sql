-- Fase 8 — SaaS Meu Rim (ADITIVA).
-- Planos, licenças e MRR. Separado do financeiro da clínica
-- (clinic_encounters / clinic_closings / Mercado Pago).
-- Sem ALTER em doctors/patients/bookings.
-- Sem licença a área médica continua liberada.

create table if not exists public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_cents integer not null default 0,
  doctor_seats integer not null default 1,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_licenses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id),
  clinic_id uuid,
  doctor_id uuid,
  status text not null default 'active',
  period_start date,
  period_end date,
  monthly_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz
);
create index if not exists saas_licenses_clinic_idx
  on public.saas_licenses (clinic_id, status);
create index if not exists saas_licenses_doctor_idx
  on public.saas_licenses (doctor_id, status);
create index if not exists saas_licenses_status_idx
  on public.saas_licenses (status);

create table if not exists public.saas_mrr_snapshots (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  mrr_cents integer not null default 0,
  licenses_active integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists saas_mrr_snapshots_month_idx
  on public.saas_mrr_snapshots (year_month desc, created_at desc);

alter table public.saas_plans enable row level security;
alter table public.saas_licenses enable row level security;
alter table public.saas_mrr_snapshots enable row level security;

grant all privileges on public.saas_plans to service_role;
grant all privileges on public.saas_licenses to service_role;
grant all privileges on public.saas_mrr_snapshots to service_role;

comment on table public.saas_plans is
  'Catálogo SaaS Meu Rim. Não é produção/repasse da clínica.';
comment on table public.saas_licenses is
  'Licença de clínica ou médico solo. Ausência NÃO bloqueia login nem prontuário.';
comment on table public.saas_mrr_snapshots is
  'MRR calculado. Sem dados de paciente.';
