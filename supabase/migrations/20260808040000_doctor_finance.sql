-- Regras financeiras: preço (definido pelo médico) x percentual de repasse
-- (definido SOMENTE pelo administrador), com liberação de recebimento e histórico.

-- Percentual de repasse do médico (0–100) e status de liberação financeira.
alter table public.doctors add column if not exists commission_percent integer;
alter table public.doctors add column if not exists payout_status text default 'active';

-- Snapshot do percentual aplicado em cada pagamento (não recalcular pagamentos antigos).
alter table public.payments add column if not exists doctor_share_percent integer;

-- Histórico de alterações financeiras (preço e percentual), com autor e data.
create table if not exists public.doctor_financial_events (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  kind text not null check (kind in ('price', 'commission', 'payout_status')),
  old_value text,
  new_value text not null,
  changed_by text not null check (changed_by in ('admin', 'medico')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_financial_events_doctor_idx
  on public.doctor_financial_events (doctor_id, created_at desc);
