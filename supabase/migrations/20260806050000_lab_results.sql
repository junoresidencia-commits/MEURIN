-- Resultados de exames laboratoriais (foco nefrologia) para gráficos no prontuário.
create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_email text not null,
  doctor_id uuid,
  test_key text not null,
  value numeric not null,
  unit text,
  reference_range text,
  origin text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lab_results_email_test_idx
  on public.lab_results (patient_email, test_key, measured_at);

alter table public.lab_results enable row level security;
grant all privileges on public.lab_results to service_role;

comment on table public.lab_results is 'Resultados laboratoriais por data (creatinina, TFGe, RAC, etc.).';
