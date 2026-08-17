-- CPF do médico (para documentos/LME). Aditiva e reversível.
alter table public.doctors add column if not exists cpf text;
