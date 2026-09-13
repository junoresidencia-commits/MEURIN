-- Fase 3 — financeiro da clínica (ADITIVO).
-- Independente do commissionPercent global do médico / Mercado Pago.
-- Produção (atendido) ≠ recebido (check-in). Sem fechamento/PDF nesta fase.

create table if not exists public.clinic_fee_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  doctor_id uuid not null,
  fee_cents integer not null default 0,
  clinic_share_percent numeric(5, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clinic_fee_rules_unique
  on public.clinic_fee_rules (clinic_id, doctor_id)
  where active = true;

create table if not exists public.clinic_encounters (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  booking_id text,
  fee_cents integer not null default 0,
  clinic_share_cents integer not null default 0,
  doctor_share_cents integer not null default 0,
  received_cents integer not null default 0,
  payment_status text not null default 'pending',
  attended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists clinic_encounters_clinic_idx
  on public.clinic_encounters (clinic_id, attended_at desc);
create index if not exists clinic_encounters_doctor_idx
  on public.clinic_encounters (doctor_id, attended_at desc);

create table if not exists public.clinic_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  encounter_id uuid not null references public.clinic_encounters(id),
  method text not null,
  amount_cents integer not null default 0,
  discount_cents integer not null default 0,
  status text not null default 'paid',
  note text,
  recorded_by_kind text,
  recorded_by_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists clinic_payments_encounter_idx
  on public.clinic_payments (encounter_id, created_at desc);

alter table public.clinic_fee_rules enable row level security;
alter table public.clinic_encounters enable row level security;
alter table public.clinic_payments enable row level security;

grant all privileges on public.clinic_fee_rules to service_role;
grant all privileges on public.clinic_encounters to service_role;
grant all privileges on public.clinic_payments to service_role;

comment on table public.clinic_fee_rules is
  'Valor/repasse no vínculo MÉDICO↔CLÍNICA. Não usa commissionPercent global.';
comment on table public.clinic_encounters is
  'Produção clínica: atendido no finalizar atendimento. Recebido começa em 0.';
comment on table public.clinic_payments is
  'Check-in financeiro (Pix/cartão/dinheiro/cortesia). Não é o pagamento MP da teleconsulta.';
