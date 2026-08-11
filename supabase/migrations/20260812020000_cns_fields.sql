-- CNS (Cartão Nacional de Saúde): médico (sempre) e paciente (quando necessário).
-- Aditivo/idempotente. Reutilizado no preenchimento da LME oficial.
alter table public.doctors add column if not exists cns text;
alter table public.patients add column if not exists cns text;
