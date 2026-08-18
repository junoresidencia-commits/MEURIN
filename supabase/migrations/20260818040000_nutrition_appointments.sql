-- ============================================================================
-- Nutrição Renal — Fase 5: consulta/agenda/pagamento próprios da nutrição
-- (aditivo/idempotente). Pagamento por Pix direto + comprovante; comissão/repasse.
-- ============================================================================
create extension if not exists pgcrypto;

-- Configurações financeiras/profissionais da nutricionista.
alter table public.nutritionists add column if not exists consultation_price_cents integer;
alter table public.nutritionists add column if not exists return_price_cents integer;
alter table public.nutritionists add column if not exists pix_profile jsonb;         -- {keyType,key,holderName,holderDoc,bank,city}
alter table public.nutritionists add column if not exists commission_percent integer; -- % da plataforma (definido pelo admin)
alter table public.nutritionists add column if not exists payout_status text not null default 'active'; -- active | pending | blocked

-- Consultas de nutrição (separado do Booking do médico).
create table if not exists public.nutrition_appointments (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null,
  nutritionist_name text,
  doctor_id uuid,
  patient_key text not null,
  patient_name text,
  slot_start timestamptz,
  modality text default 'teleconsulta', -- teleconsulta | presencial
  price_cents integer not null default 0,
  status text not null default 'aguardando_pagamento', -- aguardando_pagamento | aguardando_confirmacao | confirmada | cancelada | realizada
  payment_method text default 'pix_direto',
  pix_copia_cola text,
  proof_url text,
  -- snapshot imutável do rateio no momento da criação
  commission_percent integer,
  platform_fee_cents integer,
  nutritionist_payout_cents integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nutrition_appointments_nut_idx on public.nutrition_appointments (nutritionist_id);
create index if not exists nutrition_appointments_patient_idx on public.nutrition_appointments (patient_key);

alter table public.nutrition_appointments enable row level security;
grant all privileges on table public.nutrition_appointments to service_role;
