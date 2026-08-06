-- Documentos clínicos: receita, pedido de exame e relatório.
-- Acesso server-side (service_role). RLS habilitado sem policies públicas.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid not null,
  doctor_name text not null,
  doctor_crm text,
  type text not null check (type in ('receita', 'exame', 'relatorio')),
  title text not null,
  body text not null default '',
  shared_with_patient boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists documents_email_idx
  on public.documents (patient_email, created_at desc);

alter table public.documents enable row level security;

grant all privileges on public.documents to service_role;

comment on table public.documents is 'Receitas, pedidos de exame e relatórios emitidos pelo médico.';
