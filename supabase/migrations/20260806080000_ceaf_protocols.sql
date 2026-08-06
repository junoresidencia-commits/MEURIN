-- Biblioteca de protocolos do CEAF (gerenciada pelo administrador).
-- Conteúdo clínico é cadastrado pelo administrador/médico (não fixado em código).
create table if not exists public.ceaf_protocols (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cid10 text,
  medications jsonb not null default '[]'::jsonb,
  required_exams jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  notes text,
  source text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ceaf_protocols_active_idx on public.ceaf_protocols (active, name);

alter table public.ceaf_protocols enable row level security;
grant all privileges on public.ceaf_protocols to service_role;

comment on table public.ceaf_protocols is 'Protocolos do CEAF: doença -> CID, medicamentos, exames e documentos exigidos.';
