-- Confirmação da consulta pelo médico, proposta de novo horário, remarcação
-- (mantendo o pagamento) e linha do tempo. Não altera pagamentos existentes.

-- WhatsApp do médico para avisos de consultas
alter table public.doctors add column if not exists notify_whatsapp text;
alter table public.doctors add column if not exists use_whatsapp_notifications boolean not null default false;

-- Fluxo de agendamento (separado do pagamento) na consulta
alter table public.bookings add column if not exists stage text;               -- ver ConsultationStage
alter table public.bookings add column if not exists events jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists proposed_slot_start timestamptz;
alter table public.bookings add column if not exists proposed_slot_end timestamptz;
alter table public.bookings add column if not exists proposal_message text;
alter table public.bookings add column if not exists proposal_by text;
alter table public.bookings add column if not exists not_realized_reason text;
