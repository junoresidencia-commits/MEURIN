-- Vínculo dos documentos complementares à LME e protocolo CEAF da solicitação.
-- Aditivo e idempotente. Sem alterar a LME oficial.

alter table if exists public.lme_requests
  add column if not exists protocol_id text;

comment on column public.lme_requests.protocol_id is
  'ID do protocolo CEAF oficial escolhido no assistente (para TER/formulário).';

alter table if exists public.documents
  add column if not exists source_lme_id text;

comment on column public.documents.source_lme_id is
  'LME de origem quando o documento (receita, relatório, TER) foi gerado a partir dela.';

create index if not exists documents_source_lme_idx
  on public.documents (source_lme_id, type);
