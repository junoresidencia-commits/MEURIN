-- (1) Desconto/cupom na consulta avulsa: guarda o snapshot financeiro da consulta.
alter table public.bookings add column if not exists pricing jsonb;

-- (2) Renovação de planos: marca quando o aviso de vencimento já foi enviado
-- (evita reenviar o lembrete a cada leitura).
alter table public.plan_enrollments add column if not exists renewal_notified_at timestamptz;
