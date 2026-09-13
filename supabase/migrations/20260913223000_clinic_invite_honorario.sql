-- Valor e % da clínica no convite do médico (ADITIVA).
-- Sem isso o honorário de médico JÁ cadastrado ainda grava em clinic_fee_rules na hora.
-- Estas colunas só guardam o valor até um médico NOVO aceitar o convite.

alter table public.clinic_invites
  add column if not exists fee_cents integer,
  add column if not exists clinic_share_percent numeric;

comment on column public.clinic_invites.fee_cents is
  'Valor da consulta NESTA clínica, definido pela gestora no cadastro.';
comment on column public.clinic_invites.clinic_share_percent is
  'Percentual da clínica neste vínculo (0-100). O restante é o médico.';
