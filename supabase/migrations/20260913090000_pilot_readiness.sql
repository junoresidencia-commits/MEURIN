-- Prontidão do piloto (ADITIVO).
-- Não altera doctors, patients, bookings, clinical_notes, documents, lab_results.
-- Rodar em STAGING primeiro. Backup obrigatório antes de produção.

create unique index if not exists clinic_closings_period_unique
  on public.clinic_closings (clinic_id, doctor_id, period_from, period_to);

create index if not exists platform_audit_log_actor_email_idx
  on public.platform_audit_log (actor_email, created_at desc);

create index if not exists platform_audit_log_action_idx
  on public.platform_audit_log (action, created_at desc);

comment on index clinic_closings_period_unique is
  'Impede dois fechamentos do mesmo médico no mesmo período da mesma clínica.';
