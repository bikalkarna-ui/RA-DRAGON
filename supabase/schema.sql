-- RA Solution v3 — Drop everything and recreate
drop table if exists imports cascade;
drop table if exists activity_logs cascade;
drop table if exists fuel_entries cascade;
drop table if exists lottery_entries cascade;
drop table if exists invoice_items cascade;
drop table if exists invoices cascade;
drop table if exists sale_items cascade;
drop table if exists sales cascade;
drop table if exists vendor_order_items cascade;
drop table if exists vendor_orders cascade;
drop table if exists vendors cascade;
drop table if exists products cascade;
drop table if exists categories cascade;
drop table if exists employees cascade;
drop table if exists register_syncs cascade;
drop table if exists stores cascade;

-- Stores
create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, address text, city text, state text, phone text, email text,
  tax_rate numeric(6,4) not null default 0.0825,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table stores enable row level security;
create policy "s_own" on stores for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());

-- Employees
create table employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null, email text, pin text not null,
  role text not null default 'cashier', is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table employees enable row level security;
create policy "e_own" on employees for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  vendor_company text, sku text, barcode text, name text not null,
  unit_cost numeric(10,2) not null default 0,
  unit_price numeric(10,2) not null default 0,
  quantity integer not null default 0,
  min_quantity integer not null default 5,
  max_quantity integer not null default 100,
  taxable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_store on products(store_id);
create index products_barcode on products(store_id,barcode);
alter table products enable row level security;
create policy "p_own" on products for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Vendors
create table vendors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  company_name text not null, rep_name text, phone text, email text,
  is_preset boolean not null default false,
  created_at timestamptz not null default now()
);
alter table vendors enable row level security;
create policy "v_own" on vendors for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Vendor orders
create table vendor_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  vendor_name text not null, status text not null default 'draft',
  ai_generated boolean not null default false, ai_reasoning text,
  total_estimated numeric(10,2) not null default 0,
  created_at timestamptz not null default now(), sent_at timestamptz
);
alter table vendor_orders enable row level security;
create policy "vo_own" on vendor_orders for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Vendor order items
create table vendor_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references vendor_orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, sku text,
  current_stock integer not null default 0,
  suggested_qty integer not null default 0,
  approved_qty integer,
  unit_cost numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  reason text
);
alter table vendor_order_items enable row level security;
create policy "voi_own" on vendor_order_items for all
  using (order_id in (select vo.id from vendor_orders vo join stores s on s.id=vo.store_id where s.owner_id=auth.uid()))
  with check (order_id in (select vo.id from vendor_orders vo join stores s on s.id=vo.store_id where s.owner_id=auth.uid()));

-- Sales
create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  employee_name text, subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0, total numeric(10,2) not null default 0,
  payment_method text not null default 'cash',
  source text not null default 'pos', -- 'pos' | 'modisoft_sync'
  created_at timestamptz not null default now()
);
create index sales_store on sales(store_id);
create index sales_date on sales(store_id,created_at desc);
alter table sales enable row level security;
create policy "sa_own" on sales for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Sale items
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, vendor_company text, category text, sku text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  taxable boolean not null default true,
  line_total numeric(10,2) not null default 0
);
alter table sale_items enable row level security;
create policy "si_own" on sale_items for all
  using (sale_id in (select s.id from sales s join stores st on st.id=s.store_id where st.owner_id=auth.uid()))
  with check (sale_id in (select s.id from sales s join stores st on st.id=s.store_id where st.owner_id=auth.uid()));

-- Register syncs (Modisoft daily report uploads)
create table register_syncs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  sync_date date not null default current_date,
  source text not null default 'modisoft',
  file_path text,
  status text not null default 'processing',
  raw_ai_response jsonb,
  -- Extracted totals
  gross_sales numeric(10,2),
  net_sales numeric(10,2),
  cash_sales numeric(10,2),
  card_sales numeric(10,2),
  tax_collected numeric(10,2),
  transaction_count integer,
  top_categories jsonb,
  top_products jsonb,
  notes text,
  created_at timestamptz not null default now()
);
alter table register_syncs enable row level security;
create policy "rs_own" on register_syncs for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  vendor_name text, vendor_company text, invoice_number text, invoice_date date,
  total_amount numeric(10,2), file_path text,
  status text not null default 'PROCESSING',
  price_changes_count integer not null default 0,
  raw_ai_response jsonb,
  created_at timestamptz not null default now()
);
alter table invoices enable row level security;
create policy "i_own" on invoices for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Invoice items
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  raw_description text not null, matched_name text,
  quantity numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  old_cost numeric(10,2), line_total numeric(10,2) not null default 0,
  suggested_price numeric(10,2), old_price numeric(10,2),
  price_changed boolean not null default false,
  match_confidence numeric(3,2), is_new_product boolean not null default false,
  action text not null default 'pending'
);
alter table invoice_items enable row level security;
create policy "ii_own" on invoice_items for all
  using (invoice_id in (select i.id from invoices i join stores s on s.id=i.store_id where s.owner_id=auth.uid()))
  with check (invoice_id in (select i.id from invoices i join stores s on s.id=i.store_id where s.owner_id=auth.uid()));

-- Lottery entries
create table lottery_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  entry_date date not null default current_date,
  scratch_sales numeric(10,2) not null default 0,
  scratch_payouts numeric(10,2) not null default 0,
  scratch_net numeric(10,2) generated always as (scratch_sales - scratch_payouts) stored,
  lotto_sales numeric(10,2) not null default 0,
  lotto_payouts numeric(10,2) not null default 0,
  lotto_net numeric(10,2) generated always as (lotto_sales - lotto_payouts) stored,
  total_net numeric(10,2) generated always as ((scratch_sales+lotto_sales)-(scratch_payouts+lotto_payouts)) stored,
  books_activated integer not null default 0,
  books_settled integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table lottery_entries enable row level security;
create policy "le_own" on lottery_entries for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Fuel entries
create table fuel_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  entry_date date not null default current_date,
  regular_gallons numeric(10,2) not null default 0, regular_price numeric(6,3) not null default 0,
  plus_gallons numeric(10,2) not null default 0, plus_price numeric(6,3) not null default 0,
  premium_gallons numeric(10,2) not null default 0, premium_price numeric(6,3) not null default 0,
  diesel_gallons numeric(10,2) not null default 0, diesel_price numeric(6,3) not null default 0,
  total_gallons numeric(10,2) generated always as (regular_gallons+plus_gallons+premium_gallons+diesel_gallons) stored,
  total_fuel_sales numeric(10,2) generated always as ((regular_gallons*regular_price)+(plus_gallons*plus_price)+(premium_gallons*premium_price)+(diesel_gallons*diesel_price)) stored,
  notes text, created_at timestamptz not null default now()
);
alter table fuel_entries enable row level security;
create policy "fe_own" on fuel_entries for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Imports
create table imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  type text not null, status text not null default 'pending',
  file_name text, total_rows integer not null default 0,
  imported_rows integer not null default 0, failed_rows integer not null default 0,
  ai_mapping jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table imports enable row level security;
create policy "im_own" on imports for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Triggers
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at=now(); return new; end; $$ language plpgsql;
create trigger stores_upd before update on stores for each row execute function set_updated_at();
create trigger products_upd before update on products for each row execute function set_updated_at();

-- Storage
insert into storage.buckets(id,name,public) values('invoices','invoices',false),('reports','reports',false) on conflict(id) do nothing;
create policy "inv_up" on storage.objects for insert with check(bucket_id in ('invoices','reports') and (storage.foldername(name))[1] in (select id::text from stores where owner_id=auth.uid()));
create policy "inv_rd" on storage.objects for select using(bucket_id in ('invoices','reports') and (storage.foldername(name))[1] in (select id::text from stores where owner_id=auth.uid()));
