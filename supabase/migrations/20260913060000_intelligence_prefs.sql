-- Fase 6 — preferências da inteligência clínica (ADITIVO).
-- Sem ALTER em doctors/patients/bookings/clinical_notes.
-- Nada aqui aplica evolução no perfil: só configura o que pode ser sugerido.

create table if not exists public.intelligence_preferences (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  scope_id text not null,
  enabled boolean not null default true,
  apply_mode text not null default 'review_only',
  modules jsonb not null default '{}'::jsonb,
  allow_backfill boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists intelligence_preferences_scope_idx
  on public.intelligence_preferences (scope, scope_id);

alter table public.intelligence_preferences enable row level security;
grant all privileges on public.intelligence_preferences to service_role;

comment on table public.intelligence_preferences is
  'Configuração da inteligência clínica. apply_mode=review_only: nunca grava no perfil sozinha.';
