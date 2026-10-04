-- Retorno + cobrança da plataforma por profissional da equipe.
-- Aditivo. Admin define grátis / % / valor por atendimento ou entrada.

alter table public.allied_professionals
  add column if not exists return_price_cents integer,
  add column if not exists commission_percent integer,
  add column if not exists entry_fee_cents integer,
  add column if not exists app_fee_mode text not null default 'gratis',
  add column if not exists payout_status text not null default 'active';

alter table public.nutritionists
  add column if not exists entry_fee_cents integer,
  add column if not exists app_fee_mode text not null default 'gratis';

alter table public.doctors
  add column if not exists entry_fee_cents integer,
  add column if not exists app_fee_mode text not null default 'gratis';

alter table public.care_rooms
  add column if not exists is_return boolean not null default false;

create table if not exists public.platform_charges (
  id uuid primary key default gen_random_uuid(),
  actor_kind text not null,
  professional_id text not null,
  professional_name text not null,
  kind text not null,
  source_id text not null,
  amount_cents integer not null default 0,
  status text not null default 'due',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists platform_charges_source_idx on public.platform_charges (professional_id, source_id);
create index if not exists platform_charges_status_idx on public.platform_charges (status, created_at desc);

alter table public.platform_charges enable row level security;
grant all privileges on table public.platform_charges to service_role;
