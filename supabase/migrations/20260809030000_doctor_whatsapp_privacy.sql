-- Privacidade do WhatsApp do médico: número interno de notificações (nunca exposto)
-- separado do número de contato dos pacientes (pode ser secretária/clínica).

alter table public.doctors add column if not exists patient_contact_whatsapp text;
alter table public.doctors add column if not exists allow_patient_contact boolean not null default false;
alter table public.doctors add column if not exists notify_new_bookings boolean not null default true;
alter table public.doctors add column if not exists notify_payments boolean not null default true;
alter table public.doctors add column if not exists notify_reschedules boolean not null default true;
