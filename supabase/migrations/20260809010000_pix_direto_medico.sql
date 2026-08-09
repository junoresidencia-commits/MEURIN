-- PIX próprio por médico (recebimento direto, sem Mercado Pago) + comprovante.
-- NÃO altera a integração Mercado Pago existente. `pix_key` já existe desde o init.

alter table public.doctors add column if not exists pix_accept boolean not null default false;
alter table public.doctors add column if not exists pix_key_type text;
alter table public.doctors add column if not exists pix_holder_name text;
alter table public.doctors add column if not exists pix_holder_doc text;
alter table public.doctors add column if not exists pix_bank text;
alter table public.doctors add column if not exists pix_business_name text;

-- Comprovante de PIX direto enviado pelo paciente (confirmação manual do médico).
alter table public.bookings add column if not exists proof_status text;      -- 'enviado' | 'recusado'
alter table public.bookings add column if not exists proof_path text;         -- storage/local
alter table public.bookings add column if not exists proof_mime text;
alter table public.bookings add column if not exists proof_uploaded_at timestamptz;
alter table public.bookings add column if not exists proof_note text;
