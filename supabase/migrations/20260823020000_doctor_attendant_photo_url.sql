-- Foto de perfil do médico e do atendente (data URL). Aditivo e idempotente.
alter table public.doctors add column if not exists photo_url text;
alter table public.attendants add column if not exists photo_url text;
