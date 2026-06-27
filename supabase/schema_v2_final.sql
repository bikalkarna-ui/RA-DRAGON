-- RA Solution v2 Schema — Run this in Supabase SQL Editor

-- Inventory movements
create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  product_name text not null,
  type text not null,
  quantity numeric(10,2) not null,
  quantity_before numeric(10,2) not null default 0,
  quantity_after numeric(10,2) not null default 0,
  unit_cost numeric(10,2),
  unit_price numeric(10,2),
  reference_type text,
  reference_id uuid,
  reference_label text,
  employee_name text,
  notes text,
  created_at timestamptz not null default now()
);
alter table inventory_movements enable row level security;
drop policy if exists "im_own" on inventory_movements;
create policy "im_own" on inventory_movements for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Time clock
create table if not exists time_clock (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  employee_name text not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  hours_worked numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);
alter table time_clock enable row level security;
drop policy if exists "tc_own" on time_clock;
create policy "tc_own" on time_clock for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Purchase orders
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  vendor_name text not null,
  vendor_company text,
  status text not null default 'draft',
  ai_generated boolean not null default false,
  ai_notes text,
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table purchase_orders enable row level security;
drop policy if exists "po_own" on purchase_orders;
create policy "po_own" on purchase_orders for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  barcode text,
  sku text,
  department text,
  current_stock integer not null default 0,
  order_qty integer not null default 0,
  received_qty integer not null default 0,
  case_pack integer not null default 1,
  unit_cost numeric(10,2) not null default 0,
  retail_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  days_of_supply numeric(6,1),
  velocity_30d numeric(10,2) not null default 0,
  velocity_60d numeric(10,2) not null default 0,
  velocity_90d numeric(10,2) not null default 0,
  ai_reason text,
  status text not null default 'pending'
);
alter table purchase_order_items enable row level security;
drop policy if exists "poi_own" on purchase_order_items;
create policy "poi_own" on purchase_order_items for all
  using (order_id in (select po.id from purchase_orders po join stores s on s.id=po.store_id where s.owner_id=auth.uid()))
  with check (order_id in (select po.id from purchase_orders po join stores s on s.id=po.store_id where s.owner_id=auth.uid()));

-- Price history
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  product_name text not null,
  old_cost numeric(10,2),
  new_cost numeric(10,2),
  old_price numeric(10,2),
  new_price numeric(10,2),
  old_margin numeric(6,2),
  new_margin numeric(6,2),
  source text,
  invoice_id uuid references invoices(id) on delete set null,
  vendor_name text,
  created_at timestamptz not null default now()
);
alter table price_history enable row level security;
drop policy if exists "ph_own" on price_history;
create policy "ph_own" on price_history for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Add columns to existing tables
alter table products add column if not exists department text;
alter table products add column if not exists category text;
alter table products add column if not exists case_pack integer not null default 1;
alter table products add column if not exists reorder_qty integer not null default 0;
alter table products add column if not exists location text;
alter table products add column if not exists last_received_at timestamptz;
alter table products add column if not exists last_invoice_id uuid;
alter table products add column if not exists notes text;
alter table employees add column if not exists hourly_rate numeric(8,2);
alter table employees add column if not exists phone text;
