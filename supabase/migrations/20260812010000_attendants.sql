-- Perfil ATENDENTE/SECRETÁRIA: conta própria (CPF e/ou e-mail), vínculo a vários médicos,
-- permissões por vínculo e auditoria. 100% aditivo/idempotente. Não altera dados existentes.

create table if not exists public.attendants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text,
  cpf_normalized text,
  email text,
  phone text,
  whatsapp text,
  password_hash text,
  status text not null default 'active',   -- 'active' | 'inactive'
  created_at timestamptz not null default now(),
  last_access_at timestamptz
);
create index if not exists attendants_cpf_idx on public.attendants (cpf_normalized);
create index if not exists attendants_email_idx on public.attendants (lower(email));
alter table public.attendants enable row level security;
grant all privileges on table public.attendants to service_role;

-- Vínculo atendente ⇄ médico (as permissões pertencem ao VÍNCULO).
create table if not exists public.attendant_links (
  id uuid primary key default gen_random_uuid(),
  attendant_id uuid not null,
  doctor_id uuid not null,
  active boolean not null default true,
  permissions jsonb not null default '{"agenda":true,"verHorarios":true,"criarPaciente":true,"editarCadastro":true,"agendar":true,"remarcar":true,"cancelar":true,"confirmar":true,"ausencia":true,"whatsapp":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists attendant_links_unique on public.attendant_links (attendant_id, doctor_id);
create index if not exists attendant_links_doctor_idx on public.attendant_links (doctor_id);
alter table public.attendant_links enable row level security;
grant all privileges on table public.attendant_links to service_role;

-- Auditoria das ações administrativas da atendente.
create table if not exists public.attendant_audit (
  id uuid primary key default gen_random_uuid(),
  attendant_id uuid not null,
  attendant_name text,
  doctor_id uuid not null,
  action text not null,
  patient_key text,
  booking_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists attendant_audit_doctor_idx on public.attendant_audit (doctor_id, created_at desc);
alter table public.attendant_audit enable row level security;
grant all privileges on table public.attendant_audit to service_role;
