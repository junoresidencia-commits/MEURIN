-- Troca obrigatória de senha no primeiro acesso do paciente. Aditiva/idempotente.
alter table public.patients add column if not exists must_change_password boolean not null default false;
