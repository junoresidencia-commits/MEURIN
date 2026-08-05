create extension if not exists pgcrypto;

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  crm text not null,
  specialty text not null,
  bio text not null default '',
  consultation_price_cents integer not null,
  pix_key text,
  bank_account_hint text,
  stripe_connect_ready boolean not null default false,
  weekly_availability jsonb not null default '[]'::jsonb,
  blocked_slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_name text not null,
  patient_email text not null,
  patient_phone text not null default '',
  patient_city text not null default '',
  care_reason text not null check (care_reason in ('pressa', 'acompanhamento', 'segunda_opiniao', 'outro')),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  price_cents integer not null,
  payment_method text not null check (payment_method in ('card', 'pix', 'boleto')),
  status text not null check (status in ('pending_payment', 'paid', 'confirmed', 'completed', 'cancelled')),
  meeting_room_id uuid not null unique,
  payment_id uuid,
  paid_at timestamptz,
  confirmation_email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  amount_cents integer not null,
  method text not null check (method in ('card', 'pix', 'boleto')),
  status text not null check (status in ('succeeded', 'failed', 'pending')),
  doctor_payout_cents integer not null,
  platform_fee_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.signaling_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  from_role text not null check (from_role in ('doctor', 'patient')),
  type text not null check (type in ('offer', 'answer', 'ice')),
  payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists bookings_doctor_id_idx on public.bookings (doctor_id);
create index if not exists bookings_patient_email_idx on public.bookings (patient_email);
create index if not exists bookings_meeting_room_id_idx on public.bookings (meeting_room_id);
create index if not exists signaling_messages_room_id_created_at_idx
  on public.signaling_messages (room_id, created_at desc);

alter table public.doctors enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.signaling_messages enable row level security;

comment on table public.doctors is 'Meu Rim doctors. Server-side access only for now.';
comment on table public.bookings is 'Meu Rim bookings. Server-side access only for now.';
comment on table public.payments is 'Meu Rim payment records. Server-side access only for now.';
comment on table public.signaling_messages is 'Ephemeral signaling messages for WebRTC setup.';
