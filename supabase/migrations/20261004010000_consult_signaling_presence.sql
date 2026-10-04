-- Presença na sala de vídeo + tipos de sinalização (join/leave/here).
-- Sem isso o médico não vê que o paciente abriu o link, e o "leave" já quebrava no check antigo.

alter table public.signaling_messages drop constraint if exists signaling_messages_type_check;
alter table public.signaling_messages
  add constraint signaling_messages_type_check
  check (type in ('offer', 'answer', 'ice', 'join', 'leave', 'here'));

create table if not exists public.room_presence (
  room_id uuid not null,
  role text not null check (role in ('doctor', 'patient')),
  page_open boolean not null default true,
  in_call boolean not null default false,
  last_seen timestamptz not null default now(),
  primary key (room_id, role)
);

create index if not exists room_presence_seen_idx on public.room_presence (last_seen desc);

alter table public.room_presence enable row level security;

comment on table public.room_presence is 'Quem abriu / entrou na sala de teleconsulta (médico e paciente).';
