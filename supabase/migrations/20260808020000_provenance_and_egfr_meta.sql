-- Proveniência por dado + histórico de correções no perfil clínico,
-- e metadados da TFGe (equação/versão/creatinina de origem) em lab_results.

-- Perfil clínico: meta (fonte por campo) e history (log de alterações)
alter table public.patient_clinical_profile add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.patient_clinical_profile add column if not exists history jsonb not null default '[]'::jsonb;

-- Exames: metadados (ex.: TFGe calculada preservando creatinina/equação/versão)
alter table public.lab_results add column if not exists meta jsonb;
