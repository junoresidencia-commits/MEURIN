-- Conta Mercado Pago do próprio médico: quando preenchido, o pagamento da
-- consulta é cobrado nessa conta (o dinheiro vai para o médico).
-- Segredo — acessado somente no servidor (service role).
alter table public.doctors add column if not exists mp_access_token text;
