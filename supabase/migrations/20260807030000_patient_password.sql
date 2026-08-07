-- Senha de acesso do paciente (login por CPF). Padrão inicial "123456",
-- que o paciente pode trocar depois. Armazenada com hash (bcrypt).
alter table public.patients add column if not exists password_hash text;
