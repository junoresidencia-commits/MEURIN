-- Índices aditivos para busca e agenda. Sem ALTER destrutivo.
-- Staging primeiro.

create index if not exists patients_doctor_name_idx
  on public.patients (doctor_id, name);

create index if not exists patients_phone_idx
  on public.patients (phone);

create index if not exists patients_birthdate_idx
  on public.patients (birthdate);

create index if not exists bookings_doctor_slot_idx
  on public.bookings (doctor_id, slot_start);
