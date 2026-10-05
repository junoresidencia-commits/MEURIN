-- Teto do bucket privado de exames do paciente (PDF e imagem).
-- Idempotente: só altera se o bucket já existir.
update storage.buckets
set file_size_limit = 52428800
where id = 'exames';
