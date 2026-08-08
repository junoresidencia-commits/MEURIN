-- Perfil clínico estruturado do paciente (comorbidades, DRC G/A, etiologia etc.).
-- Guardado como JSONB para ser extensível (novas variáveis não exigem migração).
-- Não substitui o prontuário: apenas estrutura dados para acompanhamento e pesquisa.
create table if not exists public.patient_clinical_profile (
  patient_key text primary key,
  doctor_id uuid,
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.patient_clinical_profile enable row level security;
grant all privileges on public.patient_clinical_profile to service_role;

comment on table public.patient_clinical_profile is 'Perfil clínico estruturado (JSONB extensível) por paciente, para longitudinal e pesquisa.';
