-- Padrões de preenchimento (posições das caixas de texto) por médico e documento oficial.
create table if not exists public.ceaf_doc_patterns (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  doc_key text not null,           -- ex.: "anemia_drc_alfaepoetina:ter"
  boxes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index if not exists ceaf_doc_patterns_unique on public.ceaf_doc_patterns (doctor_id, doc_key);
alter table public.ceaf_doc_patterns enable row level security;
grant all privileges on table public.ceaf_doc_patterns to service_role;
