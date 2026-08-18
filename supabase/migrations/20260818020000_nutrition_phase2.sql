-- ============================================================================
-- Nutrição Renal — Fase 2 (aditivo/idempotente): auto-registro + aprovação + permissões
-- ============================================================================
-- Foto e documentos da nutricionista (auto-registro).
alter table public.nutritionists add column if not exists photo_url text;
alter table public.nutritionists add column if not exists documents jsonb not null default '[]'::jsonb;

-- Permissões do vínculo (acesso só ao necessário, definido pelo médico).
alter table public.nutritionist_links add column if not exists permissions jsonb not null default
  '{"verExames":true,"verDiario":true,"criarPlano":true,"comentarDiario":true}'::jsonb;

-- status já existe (text). Valores usados: 'pending' (auto-registro aguardando admin),
-- 'active' (aprovada), 'inactive', 'rejected', 'suspended'. Sem constraint para não travar.
