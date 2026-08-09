-- =====================================================================
-- MEU RIM — SQL consolidado (Agenda por locais/modalidade + reminders)
-- Rodar no Supabase → SQL Editor. É IDEMPOTENTE: pode rodar várias vezes.
-- Inclui também confirmação/remarcação e WhatsApp (seguro se já rodou).
-- =====================================================================

-- ---------- Confirmação da consulta / remarcação / timeline (#49) ----------
alter table public.doctors  add column if not exists notify_whatsapp text;
alter table public.doctors  add column if not exists use_whatsapp_notifications boolean not null default false;

alter table public.bookings add column if not exists stage text;
alter table public.bookings add column if not exists events jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists proposed_slot_start timestamptz;
alter table public.bookings add column if not exists proposed_slot_end timestamptz;
alter table public.bookings add column if not exists proposal_message text;
alter table public.bookings add column if not exists proposal_by text;
alter table public.bookings add column if not exists not_realized_reason text;

-- ---------- Privacidade do WhatsApp do médico (#49) ----------
alter table public.doctors  add column if not exists patient_contact_whatsapp text;
alter table public.doctors  add column if not exists allow_patient_contact boolean not null default false;
alter table public.doctors  add column if not exists notify_new_bookings boolean not null default true;
alter table public.doctors  add column if not exists notify_payments boolean not null default true;
alter table public.doctors  add column if not exists notify_reschedules boolean not null default true;

-- ---------- Agenda: locais, períodos, modalidade e reserva (#51) ----------
alter table public.doctors  add column if not exists locations jsonb not null default '[]'::jsonb;
alter table public.doctors  add column if not exists availability_periods jsonb not null default '[]'::jsonb;

alter table public.bookings add column if not exists modality text;
alter table public.bookings add column if not exists location_id text;
alter table public.bookings add column if not exists location_name text;

-- Reserva temporária de horário (expira). Evita dupla marcação (server-side).
create table if not exists public.appointment_holds (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  slot_start timestamptz not null,
  holder text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists appointment_holds_doctor_idx
  on public.appointment_holds (doctor_id, slot_start);
alter table public.appointment_holds enable row level security;
grant all privileges on table public.appointment_holds to service_role;

-- ---------- Lembretes 24h / 2h (#51) ----------
alter table public.bookings add column if not exists reminder_24_sent boolean not null default false;
alter table public.bookings add column if not exists reminder_2_sent  boolean not null default false;

-- Pronto. Depois de rodar, faça o deploy (merge do PR da Agenda no main).
