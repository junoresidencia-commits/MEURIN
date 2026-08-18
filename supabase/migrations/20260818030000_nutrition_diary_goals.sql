-- ============================================================================
-- Nutrição Renal — Fase 3: metas individualizadas + diário alimentar do paciente
-- (aditivo/idempotente; não altera dados existentes)
-- ============================================================================
create extension if not exists pgcrypto;

-- Metas nutricionais individualizadas (definidas pela nutricionista). Uma por paciente.
create table if not exists public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null unique,
  nutritionist_id uuid,
  nutritionist_name text,
  targets jsonb not null default '{}'::jsonb, -- {kcal,protein_g,sodium_mg,potassium_mg,phosphorus_mg,liquids_ml}
  note text,                                  -- orientação da nutricionista ao paciente
  updated_at timestamptz not null default now()
);

-- Diário alimentar do paciente (com cálculo estimado por porção).
create table if not exists public.nutrition_diary_entries (
  id uuid primary key default gen_random_uuid(),
  patient_key text not null,
  entry_date date not null default (now() at time zone 'America/Bahia')::date,
  kind text not null default 'alimento', -- 'alimento' | 'liquido'
  meal text,
  time_label text,
  food text not null,
  grams numeric,
  volume_ml numeric,
  household text,
  nutrients jsonb not null default '{}'::jsonb, -- {kcal,protein_g,carb_g,fat_g,sodium_mg,potassium_mg,phosphorus_mg}
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists nutrition_diary_patient_date_idx on public.nutrition_diary_entries (patient_key, entry_date);

alter table public.nutrition_goals enable row level security;
alter table public.nutrition_diary_entries enable row level security;
grant all privileges on table public.nutrition_goals to service_role;
grant all privileges on table public.nutrition_diary_entries to service_role;
