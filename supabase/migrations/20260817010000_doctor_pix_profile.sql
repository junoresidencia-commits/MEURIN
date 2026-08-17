-- Perfil Pix estruturado do médico (chave + titular + documento + banco), para
-- recebimento direto por Pix. Idempotente e aditivo (mantém pix_key existente).
alter table public.doctors add column if not exists pix_profile jsonb;
