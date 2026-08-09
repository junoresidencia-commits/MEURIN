-- PWA + Notificações (push web/mobile) + preferências + calendário.
-- 100% aditivo/idempotente. Não remove nem altera dados existentes.

-- ---------- Dispositivos/assinaturas de push (um usuário pode ter vários) ----------
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- id do médico (uuid) OU chave do paciente (cpf/e-mail)
  role text not null default 'paciente', -- 'medico' | 'paciente'
  platform text not null default 'web',  -- 'web' | 'ios' | 'android'
  endpoint text not null,                -- endpoint do PushSubscription (único por dispositivo)
  subscription jsonb not null,           -- PushSubscription completo (keys p256dh/auth)
  device_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists user_devices_endpoint_key on public.user_devices (endpoint);
create index if not exists user_devices_user_idx on public.user_devices (user_id);
alter table public.user_devices enable row level security;
grant all privileges on table public.user_devices to service_role;

-- ---------- Histórico + central de notificações (in-app) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                 -- destinatário (médico id ou chave do paciente)
  role text not null default 'paciente',
  type text not null,                    -- ex.: nova_consulta, confirmada, remarcada, lembrete...
  title text not null,
  message text,
  target_url text,                       -- deep link interno
  related_entity_type text,              -- ex.: 'booking'
  related_entity_id text,
  read_at timestamptz,
  sent_at timestamptz,                   -- quando push foi disparado (best-effort)
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
grant all privileges on table public.notifications to service_role;

-- ---------- Preferências do médico (push + lembretes + calendário + fuso) ----------
alter table public.doctors add column if not exists notify_push boolean not null default true;
alter table public.doctors add column if not exists notify_reminder_24 boolean not null default true;
alter table public.doctors add column if not exists notify_reminder_2 boolean not null default true;
-- Formato do título do evento no calendário do médico: 'meurim' = "Consulta — Meu Rim"; 'patient' = "Consulta — Nome".
alter table public.doctors add column if not exists calendar_event_mode text not null default 'meurim';
alter table public.doctors add column if not exists tz text not null default 'America/Bahia';

-- ---------- Preferências do paciente (quando cadastrado) ----------
alter table public.patients add column if not exists notify_push boolean not null default true;
alter table public.patients add column if not exists notify_reminder_24 boolean not null default true;
alter table public.patients add column if not exists notify_reminder_2 boolean not null default true;
