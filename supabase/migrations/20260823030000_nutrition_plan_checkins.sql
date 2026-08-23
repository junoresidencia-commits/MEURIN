-- Aderência ao plano alimentar: refeições do plano cumpridas por paciente/dia.
create table if not exists public.nutrition_plan_checkins (
  patient_key text not null,
  date text not null,
  meals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (patient_key, date)
);
