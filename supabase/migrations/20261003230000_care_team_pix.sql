-- Pix e valor da consulta da equipe (psicologia, enfermagem) + cobrança na sala.
-- Aditivo. Nutrição já tem pix_profile em nutritionists.

alter table public.allied_professionals
  add column if not exists consultation_price_cents integer,
  add column if not exists pix_profile jsonb;

alter table public.care_rooms
  add column if not exists price_cents integer not null default 0,
  add column if not exists pix_copia_cola text,
  add column if not exists pix_holder_name text,
  add column if not exists payment_status text not null default 'free';
