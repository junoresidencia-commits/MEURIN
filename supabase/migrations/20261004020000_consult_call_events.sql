-- Telemetria da videochamada: só estado técnico, sem SDP, nomes ou evolução.

create table if not exists public.consult_call_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  role text not null check (role in ('doctor', 'patient')),
  kind text not null,
  ice_state text,
  browser text,
  turn boolean,
  phase text,
  created_at timestamptz not null default now()
);

create index if not exists consult_call_events_room_idx
  on public.consult_call_events (room_id, created_at desc);

alter table public.consult_call_events enable row level security;

comment on table public.consult_call_events is 'Falhas e estados da videochamada. Sem conteúdo clínico.';
