-- Fase 5 — encaminhamento intra-clínica (ADITIVO).
-- Em cima de patient_doctor_shares. Sem ALTER em doctors/patients/bookings.
-- Pacientes atuais NÃO são migrados. clinic_id no vínculo é pontual (referral).

create table if not exists public.clinic_referrals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  share_id uuid,
  patient_key text not null,
  patient_name text,
  from_doctor_id uuid not null,
  from_doctor_name text,
  from_specialty text,
  to_doctor_id uuid not null,
  to_doctor_name text,
  to_specialty text,
  reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists clinic_referrals_clinic_idx
  on public.clinic_referrals (clinic_id, status, created_at desc);
create index if not exists clinic_referrals_from_idx
  on public.clinic_referrals (from_doctor_id, status);
create index if not exists clinic_referrals_to_idx
  on public.clinic_referrals (to_doctor_id, status);
create index if not exists clinic_referrals_share_idx
  on public.clinic_referrals (share_id);

alter table public.clinic_referrals enable row level security;
grant all privileges on public.clinic_referrals to service_role;

comment on table public.clinic_referrals is
  'Encaminhamento intra-clínica. Não move o paciente: o cadastro continua no médico original.';
