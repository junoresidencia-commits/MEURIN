-- Logo do médico exibida no cabeçalho dos documentos/PDF (data URL base64 ou URL pública).
alter table public.doctors add column if not exists logo_url text;
