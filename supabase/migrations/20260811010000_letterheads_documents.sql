-- Motor universal de documentos: papéis timbrados por médico + extensão da tabela documents.
-- 100% aditivo/idempotente. Não remove dados. Não altera identidade visual da plataforma.

-- ---------- Papéis timbrados (por médico) ----------
create table if not exists public.letterheads (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  kind text not null default 'image',       -- 'pdf' | 'image'
  mime text,
  storage text not null default 'supabase',  -- 'supabase' | 'local'
  file_path text not null,                   -- caminho no bucket (ou local em dev)
  is_default boolean not null default false,
  active boolean not null default true,
  -- Área útil (frações 0..1 da página A4) + comportamento de páginas.
  area jsonb not null default '{"marginTop":0.22,"marginBottom":0.14,"marginLeft":0.10,"marginRight":0.10,"repeat":"all","showPatientHeader":true,"showSignature":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists letterheads_doctor_idx on public.letterheads (doctor_id, created_at desc);
alter table public.letterheads enable row level security;
grant all privileges on table public.letterheads to service_role;

-- ---------- Extensão da tabela documents (universal) ----------
-- Libera o tipo (documento livre, atestado, encaminhamento, laudo, etc.) sem quebrar dados.
alter table public.documents drop constraint if exists documents_type_check;

alter table public.documents add column if not exists letterhead_id text;
alter table public.documents add column if not exists pdf_path text;         -- PDF final gerado (storage)
alter table public.documents add column if not exists pdf_storage text;      -- 'supabase' | 'local'
alter table public.documents add column if not exists status text not null default 'draft'; -- draft | final | signed
alter table public.documents add column if not exists version integer not null default 1;
alter table public.documents add column if not exists group_id uuid;         -- agrupa versões do mesmo documento
alter table public.documents add column if not exists content_json jsonb;    -- conteúdo estruturado (opcional)
alter table public.documents add column if not exists signed_at timestamptz;
alter table public.documents add column if not exists signed_by text;
alter table public.documents add column if not exists signature_method text; -- 'eletronica' | 'imagem' | 'certificada'
alter table public.documents add column if not exists signature_hash text;
alter table public.documents add column if not exists available_at timestamptz;   -- quando foi disponibilizado ao paciente
alter table public.documents add column if not exists patient_viewed_at timestamptz;
alter table public.documents add column if not exists history jsonb not null default '[]'::jsonb;
