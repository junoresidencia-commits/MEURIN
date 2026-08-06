-- Configurações da plataforma (dados da empresa/controlador para documentos legais).
-- Linha única (id fixo). Acesso apenas server-side (service_role).

create table if not exists public.platform_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
grant all privileges on public.platform_settings to service_role;

insert into public.platform_settings (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

comment on table public.platform_settings is 'Dados da empresa e configurações da plataforma.';
