-- Idade do paciente: nascimento (fonte principal) + idade manual com data de referência.
-- Não inventa data de nascimento a partir da idade. Idempotente.

alter table if exists public.patients
  add column if not exists age_years integer;

alter table if exists public.patients
  add column if not exists age_reported_at date;

comment on column public.patients.age_years is
  'Idade informada manualmente (anos). Só usada se birthdate estiver vazia.';
comment on column public.patients.age_reported_at is
  'Data (ou 1º do mês) em que a idade manual foi referida. Evita ambiguidade futura.';

-- Estudo: fonte Hemodiálise + data de referência da idade (opcional).
alter table if exists public.research_studies
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table if exists public.research_studies
  add column if not exists age_reference_date date;

comment on column public.research_studies.sources is
  'Fontes da coorte, ex.: ["hemodialise"]. Vazio = prontuário (comportamento atual).';
comment on column public.research_studies.age_reference_date is
  'Data em que a idade é calculada (inclusão no estudo). Vazio = hoje.';
