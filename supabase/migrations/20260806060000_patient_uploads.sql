-- Exames/documentos enviados pelo paciente (arquivos em bucket privado 'exames').
create table if not exists public.patient_uploads (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  uploader text not null default 'patient',
  name text not null,
  category text,
  file_path text not null,
  mime text,
  size_bytes integer,
  exam_date date,
  created_at timestamptz not null default now()
);

create index if not exists patient_uploads_email_idx
  on public.patient_uploads (patient_email, created_at desc);

alter table public.patient_uploads enable row level security;
grant all privileges on public.patient_uploads to service_role;

comment on table public.patient_uploads is 'Metadados dos exames/documentos enviados pelo paciente (arquivo no Storage privado).';
