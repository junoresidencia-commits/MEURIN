-- Cidade pública no perfil da equipe (psico, enfermagem, nutrição).
alter table public.allied_professionals
  add column if not exists city text;

alter table public.nutritionists
  add column if not exists city text;
