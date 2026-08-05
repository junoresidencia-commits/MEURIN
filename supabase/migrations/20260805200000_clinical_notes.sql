-- Evolução/consulta escrita pelo médico no prontuário do paciente.
-- Acesso server-side (service_role). RLS habilitado sem policies públicas.

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid not null,
  doctor_name text not null,
  kind text not null default 'evolucao',
  chief_complaint text,
  history text,
  assessment text,
  plan text,
  shared_with_patient boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clinical_notes_email_idx
  on public.clinical_notes (patient_email, created_at desc);

alter table public.clinical_notes enable row level security;

grant all privileges on public.clinical_notes to service_role;

comment on table public.clinical_notes is 'Evoluções/consultas escritas pelo médico no prontuário.';
