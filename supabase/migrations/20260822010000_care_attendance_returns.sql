-- Ciclo do atendimento e retornos programados (Painel premium).
-- Aditivo e idempotente: não altera bookings/pacientes existentes.
-- A Agenda (bookings) continua sendo a fonte da verdade das consultas.

-- Atendimento em andamento ("Iniciar/Finalizar" e "Continuar de onde parou").
create table if not exists public.care_attendance (
  id uuid primary key,
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  booking_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists care_attendance_doctor_idx on public.care_attendance (doctor_id);
create index if not exists care_attendance_open_idx on public.care_attendance (doctor_id, patient_key) where finished_at is null;

alter table public.care_attendance enable row level security;
grant all privileges on public.care_attendance to service_role;
comment on table public.care_attendance is 'Sessões de atendimento (em andamento/finalizado) por paciente. Não substitui bookings.';

-- Retornos programados (definidos ao finalizar o atendimento).
create table if not exists public.care_returns (
  id uuid primary key,
  doctor_id uuid not null,
  patient_key text not null,
  patient_name text,
  due_at timestamptz not null,
  interval_label text,
  source_booking_id text,
  status text not null default 'open',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists care_returns_doctor_idx on public.care_returns (doctor_id);
create index if not exists care_returns_open_idx on public.care_returns (doctor_id, patient_key) where status = 'open';

alter table public.care_returns enable row level security;
grant all privileges on public.care_returns to service_role;
comment on table public.care_returns is 'Retornos programados por paciente (open/done/cancelled). Alimenta a Central de Retornos.';
