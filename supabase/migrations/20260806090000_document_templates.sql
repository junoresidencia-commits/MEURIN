-- "Meus Padrões": modelos de documento reutilizáveis (por médico) com variáveis.
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  scope text not null default 'personal' check (scope in ('personal','clinic','official')),
  type text not null,
  title text not null,
  body text not null default '',
  favorite boolean not null default false,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_templates_doctor_idx on public.document_templates (doctor_id, type, created_at desc);

alter table public.document_templates enable row level security;
grant all privileges on public.document_templates to service_role;

-- Amplia os tipos de documento aceitos (mantém os existentes).
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.documents'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%type%';
  if c is not null then execute format('alter table public.documents drop constraint %I', c); end if;
exception when undefined_table then null;
end $$;

alter table public.documents
  add constraint documents_type_check
  check (type in ('receita','exame','relatorio','atestado','declaracao','encaminhamento','ter','consentimento','orientacao'));

comment on table public.document_templates is 'Modelos de documento reutilizáveis do médico (Meus Padrões).';
