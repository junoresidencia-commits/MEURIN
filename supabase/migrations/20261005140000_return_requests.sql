-- Solicitações de retorno (paciente pede, profissional valida).
-- Aditivo/idempotente. Não altera bookings, care_returns nem cortesia existentes.

create table if not exists public.return_requests (
  id uuid primary key,
  professional_kind text not null,
  professional_id text not null,
  professional_name text not null,
  professional_specialty text,
  patient_key text not null,
  patient_name text not null,
  patient_email text,
  requested_slot_start timestamptz not null,
  requested_slot_end timestamptz not null,
  requested_kind text not null default 'retorno',
  status text not null default 'pending_review',
  last_visit_at timestamptz,
  last_visit_source text,
  last_visit_location text,
  last_visit_approx text,
  days_since_last integer,
  within_habitual boolean,
  patient_note text,
  suggested_slot_start timestamptz,
  suggested_slot_end timestamptz,
  decision text,
  decision_by text,
  decision_at timestamptz,
  refusal_reason text,
  auto_message text,
  exceptional_after_30 boolean not null default false,
  converted_to_new boolean not null default false,
  booking_id text,
  price_cents integer,
  payment_status text,
  chat_open boolean not null default true,
  attendant_invited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists return_requests_patient_idx
  on public.return_requests (patient_key, created_at desc);
create index if not exists return_requests_pro_idx
  on public.return_requests (professional_kind, professional_id, created_at desc);
create index if not exists return_requests_status_idx
  on public.return_requests (status);

alter table public.return_requests enable row level security;
grant all privileges on public.return_requests to service_role;
comment on table public.return_requests is 'Solicitação de retorno: o paciente pede, o profissional valida, o horário só reserva após a confirmação.';

create table if not exists public.return_request_messages (
  id uuid primary key,
  request_id uuid not null,
  author_role text not null,
  author_id text not null,
  author_name text not null,
  body text not null default '',
  attachment_name text,
  attachment_path text,
  attachment_mime text,
  created_at timestamptz not null default now()
);
create index if not exists return_request_messages_req_idx
  on public.return_request_messages (request_id, created_at);
alter table public.return_request_messages enable row level security;
grant all privileges on public.return_request_messages to service_role;

create table if not exists public.return_request_events (
  id uuid primary key,
  request_id uuid not null,
  at timestamptz not null default now(),
  actor text not null,
  type text not null,
  detail text
);
create index if not exists return_request_events_req_idx
  on public.return_request_events (request_id, at);
alter table public.return_request_events enable row level security;
grant all privileges on public.return_request_events to service_role;
