-- Assinatura visual do médico (dataURL PNG/JPG). Usada em documentos e LME. Aditiva/idempotente.
alter table public.doctors add column if not exists signature_url text;
