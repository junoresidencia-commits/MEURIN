-- Agenda avançada: locais de atendimento, períodos por local/modalidade, modalidade
-- na consulta e reserva temporária (anti dupla marcação). Não quebra a agenda atual.

alter table public.doctors add column if not exists locations jsonb not null default '[]'::jsonb;
alter table public.doctors add column if not exists availability_periods jsonb not null default '[]'::jsonb;

alter table public.bookings add column if not exists modality text;
alter table public.bookings add column if not exists location_id text;
alter table public.bookings add column if not exists location_name text;

-- Reserva temporária de horário (expira). Server-side, evita dupla marcação.
create table if not exists public.appointment_holds (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  slot_start timestamptz not null,
  holder text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_holds_doctor_idx on public.appointment_holds (doctor_id, slot_start);
alter table public.appointment_holds enable row level security;
grant all privileges on table public.appointment_holds to service_role;
