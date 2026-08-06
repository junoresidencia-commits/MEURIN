-- Fluxo de aprovação de médicos pelo administrador + dados cadastrais.

alter table public.doctors
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'correction')),
  add column if not exists phone text,
  add column if not exists crm_state text,
  add column if not exists rqe text,
  add column if not exists clinic text,
  add column if not exists admin_note text;

-- Médicos que já existiam antes do fluxo de aprovação seguem aprovados.
update public.doctors set status = 'approved' where status is null;

create index if not exists doctors_status_idx on public.doctors (status);
