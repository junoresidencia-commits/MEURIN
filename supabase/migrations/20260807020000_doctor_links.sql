-- Biblioteca de links úteis do médico, organizados por condição/tópico
-- (ex.: Anemia, Doença Renal Crônica, CEAF). Assim o médico não precisa sair
-- do site para procurar referências e documentos.
create table if not exists public.doctor_links (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  title text not null,
  url text not null,
  category text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_links_doctor_idx on public.doctor_links (doctor_id, category);

alter table public.doctor_links enable row level security;
grant all privileges on public.doctor_links to service_role;

comment on table public.doctor_links is 'Links úteis salvos pelo médico, organizados por condição/tópico.';
