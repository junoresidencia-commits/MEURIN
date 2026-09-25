-- Caixa, despesas, fechamento diário e documentos fiscais (ADITIVO).
-- Não altera clinic_payments, clinic_encounters, clinic_closings, doctors, patients nem prontuário.

create table if not exists public.clinic_expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  occurred_at timestamptz not null default now(),
  amount_cents integer not null,
  category text not null,
  description text not null,
  method text not null,
  origin text not null,
  responsible_name text not null,
  location_label text,
  notes text,
  attachment_path text,
  attachment_storage text,
  attachment_name text,
  attachment_mime text,
  corrected_from_id uuid,
  voided_at timestamptz,
  void_reason text,
  voided_by_kind text,
  voided_by_id text,
  recorded_by_kind text,
  recorded_by_id text,
  recorded_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists clinic_expenses_clinic_idx
  on public.clinic_expenses (clinic_id, occurred_at desc);

create table if not exists public.clinic_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  day date not null,
  opening_cents integer not null default 0,
  in_cents integer not null default 0,
  out_cents integer not null default 0,
  expected_cents integer not null default 0,
  counted_cents integer not null default 0,
  difference_cents integer not null default 0,
  justification text,
  by_method jsonb not null default '{}'::jsonb,
  closed_by_kind text,
  closed_by_id text,
  closed_by_name text,
  closed_by_email text,
  created_at timestamptz not null default now(),
  unique (clinic_id, day)
);
create index if not exists clinic_cash_sessions_clinic_idx
  on public.clinic_cash_sessions (clinic_id, day desc);

create table if not exists public.clinic_fiscal_docs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  encounter_id uuid,
  patient_key text not null,
  kind text not null,
  status text not null,
  amount_cents integer not null default 0,
  service_label text not null default 'Consulta',
  payment_method text,
  patient_name text not null,
  patient_cpf text,
  patient_email text,
  patient_phone text,
  patient_address text,
  doctor_id text,
  doctor_name text,
  doctor_crm text,
  clinic_name text,
  number text,
  issued_at timestamptz,
  provider_ref text,
  error_message text,
  pdf_path text,
  pdf_storage text,
  xml_path text,
  xml_storage text,
  xml_name text,
  requested_by_kind text,
  requested_by_id text,
  requested_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_fiscal_docs_clinic_idx
  on public.clinic_fiscal_docs (clinic_id, created_at desc);
create index if not exists clinic_fiscal_docs_patient_idx
  on public.clinic_fiscal_docs (patient_key, created_at desc);

alter table public.clinic_expenses enable row level security;
alter table public.clinic_cash_sessions enable row level security;
alter table public.clinic_fiscal_docs enable row level security;

grant all privileges on public.clinic_expenses to service_role;
grant all privileges on public.clinic_cash_sessions to service_role;
grant all privileges on public.clinic_fiscal_docs to service_role;

comment on table public.clinic_expenses is
  'Saídas/despesas do caixa da clínica. Nunca apagar: correção anula e gera novo lançamento.';
comment on table public.clinic_cash_sessions is
  'Fechamento DIÁRIO do caixa físico. Distinto de clinic_closings (repasse do médico).';
comment on table public.clinic_fiscal_docs is
  'Recibo (PDF do sistema) e NFS-e (fila ou provedor oficial). Nunca inventa Nota Fiscal.';
