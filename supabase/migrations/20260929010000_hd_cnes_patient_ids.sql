-- CNES da clínica de HD e documentos do paciente para a LME.
alter table public.hd_settings add column if not exists cnes text;
alter table public.hd_patients add column if not exists cpf text;
alter table public.hd_patients add column if not exists cns text;
alter table public.hd_patients add column if not exists mother_name text;
