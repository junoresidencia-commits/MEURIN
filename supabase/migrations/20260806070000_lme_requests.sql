-- LME / CEAF: Laudo de Solicitação de Medicamento(s) do Componente Especializado.
create table if not exists public.lme_requests (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid,
  doctor_name text,
  doctor_crm text,
  doctor_cns text,
  establishment_name text,
  cnes text,
  patient_name text,
  mother_name text,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  patient_cpf text,
  patient_cns text,
  patient_phone text,
  patient_email_contact text,
  race text,
  cid10 text,
  diagnosis text,
  anamnesis text,
  prior_treatment boolean not null default false,
  prior_treatment_desc text,
  incapable boolean not null default false,
  responsible_name text,
  medications jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho',
  created_at timestamptz not null default now()
);

create index if not exists lme_requests_email_idx on public.lme_requests (patient_email, created_at desc);

alter table public.lme_requests enable row level security;
grant all privileges on public.lme_requests to service_role;

comment on table public.lme_requests is 'Solicitações de LME (CEAF) preenchidas pelo médico.';
