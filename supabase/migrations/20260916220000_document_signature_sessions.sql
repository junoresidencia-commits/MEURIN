-- Motor documental: sessões de assinatura (ADITIVO).
-- NÃO dropa documents, lme_requests, consent_*, letterheads.
-- NÃO altera IDs, pacientes, clínicas, login.

create table if not exists public.document_signature_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  patient_key text not null default '',
  doctor_id uuid not null,
  provider text not null default 'vidaas',
  method text not null default 'DIGITAL',
  status text not null default 'started',
  original_hash text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  provider_reference text,
  error_code text,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists document_signature_sessions_idempotency_idx
  on public.document_signature_sessions (idempotency_key);

create index if not exists document_signature_sessions_doc_idx
  on public.document_signature_sessions (document_id, started_at desc);

create index if not exists document_signature_sessions_patient_idx
  on public.document_signature_sessions (patient_key, started_at desc);

create index if not exists document_signature_sessions_doctor_idx
  on public.document_signature_sessions (doctor_id, started_at desc);

alter table public.document_signature_sessions enable row level security;

grant all privileges on table public.document_signature_sessions to service_role;

comment on table public.document_signature_sessions is
  'Sessão persistente de assinatura digital/manual. Sem senha, PIN ou chave privada.';
