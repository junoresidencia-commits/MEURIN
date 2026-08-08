-- Módulo de Planos de Acompanhamento, Promoções, Descontos e Cupons.
-- Reutiliza médicos/pacientes/pagamentos existentes. Acesso somente pelo servidor
-- (service_role); RLS habilitado sem policies para anon/authenticated.

-- Repasse específico por serviço (opcional). Ausente => usa commission_percent padrão.
alter table public.doctors add column if not exists consulta_commission_percent integer;
alter table public.doctors add column if not exists plan_commission_percent integer;

-- ---------- Planos (modelos criados pelo médico) ----------
create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  description text,
  price_cents integer not null default 0,
  duration text not null default '30d',
  custom_days integer,
  consultations integer not null default 1,
  interval_suggestion text,
  modality text not null default 'teleconsulta',
  availability text not null default 'publico',
  status text not null default 'rascunho',
  included jsonb not null default '[]'::jsonb,
  other_benefits text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_templates_doctor_idx on public.plan_templates (doctor_id);

-- ---------- Promoções ----------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  description text,
  scope text not null default 'all_plans',
  plan_ids jsonb not null default '[]'::jsonb,
  discount_type text not null default 'percent',
  discount_value integer not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promotions_doctor_idx on public.promotions (doctor_id);

-- ---------- Cupons ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  code text not null,
  discount_type text not null default 'percent',
  discount_value integer not null default 0,
  scope text not null default 'all_plans',
  plan_ids jsonb not null default '[]'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  max_redemptions integer,
  per_patient_once boolean not null default true,
  new_patients_only boolean not null default false,
  redemptions integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists coupons_doctor_code_idx on public.coupons (doctor_id, upper(code));

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null,
  doctor_id uuid not null,
  patient_key text not null,
  enrollment_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);

-- ---------- Contratações (assinaturas de plano) ----------
create table if not exists public.plan_enrollments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text not null,
  plan_id uuid,
  plan_name text not null,
  source text not null default 'publico',
  previous_enrollment_id uuid,
  duration_label text not null default '',
  duration_days integer not null default 30,
  start_at timestamptz,
  end_at timestamptz,
  consultations_total integer not null default 1,
  consultations_used integer not null default 0,
  status text not null default 'aguardando_pagamento',
  status_history jsonb not null default '[]'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  payment_method text not null default 'pix',
  payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_enrollments_doctor_idx on public.plan_enrollments (doctor_id);
create index if not exists plan_enrollments_patient_idx on public.plan_enrollments (patient_key);

-- ---------- Propostas personalizadas ----------
create table if not exists public.patient_offers (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text not null,
  offer_type text not null default 'plan',
  plan_name text not null,
  description text,
  duration_kind text,
  custom_days integer,
  consultations integer,
  original_price_cents integer not null default 0,
  discount_type text,
  discount_value integer,
  final_price_cents integer not null default 0,
  valid_until timestamptz,
  status text not null default 'enviada',
  enrollment_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists patient_offers_patient_idx on public.patient_offers (patient_key);
create index if not exists patient_offers_doctor_idx on public.patient_offers (doctor_id);

-- ---------- Auditoria do módulo ----------
create table if not exists public.plans_audit (
  id uuid primary key default gen_random_uuid(),
  actor text not null,           -- 'medico' | 'admin' | 'paciente' | 'sistema'
  actor_id text,
  doctor_id uuid,
  action text not null,          -- ex.: 'plan.create', 'promotion.pause', 'coupon.redeem', 'enrollment.activate'
  entity text,                   -- ex.: 'plan_template', 'enrollment'
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists plans_audit_doctor_idx on public.plans_audit (doctor_id, created_at desc);

alter table public.plan_templates enable row level security;
alter table public.promotions enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.plan_enrollments enable row level security;
alter table public.patient_offers enable row level security;
alter table public.plans_audit enable row level security;

grant all privileges on table public.plan_templates to service_role;
grant all privileges on table public.promotions to service_role;
grant all privileges on table public.coupons to service_role;
grant all privileges on table public.coupon_redemptions to service_role;
grant all privileges on table public.plan_enrollments to service_role;
grant all privileges on table public.patient_offers to service_role;
grant all privileges on table public.plans_audit to service_role;
