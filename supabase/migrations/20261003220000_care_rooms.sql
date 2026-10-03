-- Salas de teleconsulta da equipe (psicologia, enfermagem, nutrição).
-- Aditivo. A sala do médico continua em bookings.meeting_room_id.

create extension if not exists pgcrypto;

create table if not exists public.care_rooms (
  id uuid primary key default gen_random_uuid(),
  meeting_room_id uuid not null unique,
  kind text not null,
  professional_id text not null,
  professional_name text not null,
  patient_key text not null,
  patient_name text not null,
  patient_email text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_rooms_pro_idx on public.care_rooms (professional_id, status);
create index if not exists care_rooms_patient_idx on public.care_rooms (patient_key, status);
create index if not exists care_rooms_email_idx on public.care_rooms (patient_email);
