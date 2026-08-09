-- Lembretes de consulta (24h e 2h antes). Controle para não reenviar.
alter table public.bookings add column if not exists reminder_24_sent boolean not null default false;
alter table public.bookings add column if not exists reminder_2_sent boolean not null default false;
