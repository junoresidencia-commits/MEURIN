-- Histórico de mensagens/convites WhatsApp. Aditiva/idempotente.
-- (As configurações do WhatsApp ficam em platform_settings, id='whatsapp', com segredos criptografados.)
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  sender_role text,
  sender_name text,
  recipient text,
  recipient_phone text,
  method text not null default 'wame', -- 'api' | 'wame'
  status text not null default 'assistido', -- enviado | entregue | lido | falhou | assistido
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_created_idx on public.whatsapp_messages (created_at desc);
alter table public.whatsapp_messages enable row level security;
grant all privileges on table public.whatsapp_messages to service_role;
