-- Foto de perfil do paciente (data URL). Aditivo e idempotente.
alter table public.patients add column if not exists photo_url text;
