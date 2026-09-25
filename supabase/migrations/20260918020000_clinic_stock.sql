-- Estoque e compras da clínica (ADITIVO).
-- Não altera clinic_expenses, clinic_cash_sessions, clinic_payments, clinic_encounters,
-- clinic_closings, doctors, patients nem prontuário.

create table if not exists public.clinic_stock_products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  category text not null default 'outros',
  unit text not null default 'unidade',
  qty numeric not null default 0,
  min_qty numeric not null default 0,
  ideal_qty numeric not null default 0,
  location text,
  preferred_supplier_id uuid,
  notes text,
  active boolean not null default true,
  avg_cost_cents integer not null default 0,
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_stock_products_clinic_idx
  on public.clinic_stock_products (clinic_id, name);

create table if not exists public.clinic_stock_lots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  product_id uuid not null references public.clinic_stock_products(id),
  code text not null,
  qty numeric not null default 0,
  manufactured_at date,
  expires_at date,
  created_at timestamptz not null default now()
);
create index if not exists clinic_stock_lots_product_idx
  on public.clinic_stock_lots (clinic_id, product_id, expires_at);

create table if not exists public.clinic_stock_moves (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  product_id uuid not null,
  kind text not null,
  qty numeric not null,
  qty_before numeric not null,
  qty_after numeric not null,
  reason text,
  notes text,
  supplier_id uuid,
  supplier_name text,
  unit_cost_cents integer,
  total_cents integer,
  expense_id uuid,
  request_id uuid,
  lot_id uuid,
  invoice_number text,
  attachment_path text,
  attachment_storage text,
  attachment_name text,
  from_clinic_id uuid,
  to_clinic_id uuid,
  occurred_at timestamptz not null default now(),
  actor_kind text,
  actor_id text,
  actor_name text,
  actor_email text,
  created_at timestamptz not null default now()
);
create index if not exists clinic_stock_moves_clinic_idx
  on public.clinic_stock_moves (clinic_id, occurred_at desc);
create index if not exists clinic_stock_moves_product_idx
  on public.clinic_stock_moves (product_id, occurred_at desc);

create table if not exists public.clinic_stock_suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  document text,
  phone text,
  whatsapp text,
  email text,
  address text,
  products_note text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_stock_suppliers_clinic_idx
  on public.clinic_stock_suppliers (clinic_id, name);

create table if not exists public.clinic_stock_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  product_id uuid not null,
  qty numeric not null,
  priority text not null default 'normal',
  reason text,
  status text not null default 'solicitado',
  requested_by_name text not null,
  requested_by_kind text,
  requested_by_id text,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_stock_requests_clinic_idx
  on public.clinic_stock_requests (clinic_id, created_at desc);

create table if not exists public.clinic_stock_prices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  product_id uuid not null,
  unit_cost_cents integer not null,
  qty numeric not null default 0,
  supplier_name text,
  occurred_at timestamptz not null default now()
);
create index if not exists clinic_stock_prices_product_idx
  on public.clinic_stock_prices (clinic_id, product_id, occurred_at desc);

create table if not exists public.clinic_stock_settings (
  clinic_id uuid primary key references public.clinics(id),
  require_approval boolean not null default true,
  expiry_alert_days integer[] not null default array[90, 60, 30],
  extra_categories jsonb not null default '[]'::jsonb,
  extra_units jsonb not null default '[]'::jsonb
);

create table if not exists public.clinic_stock_inventories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  status text not null default 'confirmed',
  lines jsonb not null default '[]'::jsonb,
  justification text,
  actor_name text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists clinic_stock_inventories_clinic_idx
  on public.clinic_stock_inventories (clinic_id, created_at desc);
