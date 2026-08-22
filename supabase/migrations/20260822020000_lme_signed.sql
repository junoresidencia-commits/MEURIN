-- LME: rastreio de assinatura (para "LME para assinar" no Painel).
-- Aditivo e idempotente. Não altera o PDF oficial nem dados existentes.
alter table public.lme_requests add column if not exists signed_at timestamptz;
alter table public.lme_requests add column if not exists signed_by text;
create index if not exists lme_requests_doctor_idx on public.lme_requests (doctor_id, created_at desc);
