-- Nome da mãe do paciente (exigido na LME/CEAF). CNES da clínica vai no JSONB doctors.locations.
alter table public.patients add column if not exists mother_name text;
