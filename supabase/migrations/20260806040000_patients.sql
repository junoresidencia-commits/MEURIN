-- Pacientes criados diretamente pelo médico (sem depender de agendamento).
-- Acesso server-side (service_role). O médico dono é doctor_id.

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  cpf text,
  cpf_normalized text,
  birthdate date,
  sex text,
  phone text,
  email text,
  address text,
  emergency_contact text,
  guardian_name text,
  guardian_phone text,
  insurance text,
  allergies text,
  diseases text,
  medications text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists patients_doctor_idx on public.patients (doctor_id, created_at desc);
create index if not exists patients_cpf_idx on public.patients (cpf_normalized);

alter table public.patients enable row level security;
grant all privileges on public.patients to service_role;

comment on table public.patients is 'Pacientes cadastrados pelo médico (prontuário próprio).';
