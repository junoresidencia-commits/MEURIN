-- Mensagens entre paciente e equipe assistencial (nutrição, psicologia, enfermagem).
-- Aditivo/idempotente. Não altera prontuário, exames, LME, agenda ou pagamentos.

create table if not exists public.care_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null, -- 'nutrition' | 'psychology' | 'nursing'
  professional_id uuid not null,
  patient_key text not null,
  sender text not null, -- 'patient' | 'professional'
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists care_messages_thread_idx on public.care_messages (role, professional_id, patient_key, created_at);
create index if not exists care_messages_unread_idx on public.care_messages (professional_id, sender) where read_at is null;

alter table public.care_messages enable row level security;
grant all privileges on table public.care_messages to service_role;
