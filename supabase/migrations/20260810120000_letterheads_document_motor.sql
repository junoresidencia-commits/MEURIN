-- Papéis timbrados por médico + extensão de documentos clínicos (PDF final, versão, assinatura).

create table if not exists public.letterheads (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  name text not null,
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp')),
  -- Arquivo original (data URL ou path). Preferir data URL no fallback local; Supabase Storage opcional.
  file_data text not null,
  file_name text,
  -- Margens da área útil em % da página A4 (0–100).
  margin_top numeric not null default 22,
  margin_bottom numeric not null default 18,
  margin_left numeric not null default 10,
  margin_right numeric not null default 10,
  -- Posições opcionais de campos em % { x, y, w? }.
  fields jsonb not null default '{}'::jsonb,
  -- all | first | simplified
  page_mode text not null default 'all' check (page_mode in ('all', 'first', 'simplified')),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists letterheads_doctor_idx
  on public.letterheads (doctor_id, active, created_at desc);

alter table public.letterheads enable row level security;
grant all privileges on public.letterheads to service_role;

comment on table public.letterheads is 'Papéis timbrados (PDF/imagem) individuais por médico para o motor universal de documentos.';

-- Amplia tipos e campos do documento clínico (mantém linhas antigas).
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in (
    'receita', 'exame', 'relatorio', 'evolucao', 'parecer', 'atestado',
    'declaracao', 'encaminhamento', 'orientacao', 'plano', 'resumo',
    'alta', 'carta', 'termo', 'lme', 'laudo', 'livre', 'pronto'
  ));

alter table public.documents
  add column if not exists letterhead_id uuid,
  add column if not exists pdf_data text,
  add column if not exists version integer not null default 1,
  add column if not exists parent_id uuid,
  add column if not exists status text not null default 'final',
  add column if not exists signature_method text,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_hash text,
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists medications jsonb,
  add column if not exists patient_name text,
  add column if not exists patient_cpf text,
  add column if not exists document_date date;

comment on column public.documents.pdf_data is 'PDF final gerado (data URL base64). Versões assinadas são imutáveis.';
comment on column public.documents.shared_with_patient is 'Disponível na área do paciente — independente de salvo no prontuário.';
