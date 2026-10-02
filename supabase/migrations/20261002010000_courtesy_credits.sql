-- Crédito de retorno/consulta grátis liberado pelo médico para um paciente.
create table if not exists public.courtesy_credits (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_key text not null,
  patient_name text not null,
  patient_email text,
  kind text not null check (kind in ('retorno', 'gratis')),
  status text not null default 'open' check (status in ('open', 'used', 'revoked')),
  booking_id uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists courtesy_credits_doctor_idx on public.courtesy_credits (doctor_id, status);
create index if not exists courtesy_credits_patient_idx on public.courtesy_credits (doctor_id, patient_key);

alter table public.bookings add column if not exists courtesy_kind text;

alter table public.courtesy_credits enable row level security;
