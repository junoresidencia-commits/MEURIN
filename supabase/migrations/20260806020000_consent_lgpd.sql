-- Módulo de consentimento eletrônico (LGPD + CFM).
-- Documentos versionados, aceites imutáveis e trilha de auditoria.

create table if not exists public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy', 'telehealth')),
  version text not null,
  title text not null,
  body text not null,
  sha256 text not null,
  published_at timestamptz not null default now(),
  active boolean not null default true,
  unique (type, version)
);

create table if not exists public.consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  patient_id text,
  patient_email text not null,
  patient_cpf text,
  consent_type text not null,
  consent_version text not null,
  document_id uuid,
  document_sha256 text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(), -- hora do servidor
  ip_address text,
  user_agent text,
  browser text,
  operating_system text,
  device text,
  language text,
  screen_resolution text,
  session_id text,
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  patient_id text,
  patient_email text,
  action text not null,
  table_name text,
  record_id text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists consent_acceptances_email_idx
  on public.consent_acceptances (patient_email, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.consent_documents enable row level security;
alter table public.consent_acceptances enable row level security;
alter table public.audit_logs enable row level security;

grant all privileges on public.consent_documents to service_role;
grant all privileges on public.consent_acceptances to service_role;
grant all privileges on public.audit_logs to service_role;

comment on table public.consent_acceptances is 'Aceites de consentimento — imutáveis (somente INSERT; revogação via flag).';
comment on table public.audit_logs is 'Trilha de auditoria de eventos sensíveis.';
