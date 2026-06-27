-- RA Solution v4 — Full rebuild with daily close reports
drop table if exists notifications cascade;
drop table if exists daily_close_reports cascade;
drop table if exists till_readings cascade;
drop table if exists imports cascade;
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
  department text,
  unit_cost numeric(10,2) not null default 0,
  unit_price numeric(10,2) not null default 0,
  quantity integer not null default 0,
  min_quantity integer not null default 5,
  max_quantity integer not null default 100,
  taxable boolean not null default true,
  is_active boolean not null default true,
  last_sold_at timestamptz,
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
  employee_name text,
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null default 'cash',
  source text not null default 'pos',
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
  product_name text not null,
  vendor_company text, category text, department text, sku text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  taxable boolean not null default true,
  line_total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table sale_items enable row level security;
create policy "si_own" on sale_items for all
  using (sale_id in (select s.id from sales s join stores st on st.id=s.store_id where st.owner_id=auth.uid()))
  with check (sale_id in (select s.id from sales s join stores st on st.id=s.store_id where st.owner_id=auth.uid()));

-- Till readings — employees submit close-till reports (can happen multiple times/day)
create table till_readings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  employee_name text,
  reading_date date not null default current_date,
  reading_time timestamptz not null default now(),
  -- Cash counted in till
  cash_counted numeric(10,2) not null default 0,
  checks_counted numeric(10,2) not null default 0,
  -- Payment totals from register
  cash_sales numeric(10,2) not null default 0,
  credit_sales numeric(10,2) not null default 0,
  debit_sales numeric(10,2) not null default 0,
  ebt_sales numeric(10,2) not null default 0,
  check_sales numeric(10,2) not null default 0,
  mobile_sales numeric(10,2) not null default 0,
  -- Payouts
  mac_payout numeric(10,2) not null default 0,
  lotto_paid numeric(10,2) not null default 0,
  lottery_paid numeric(10,2) not null default 0,
  purchase_paid numeric(10,2) not null default 0,
  -- Department sales
  dept_tax numeric(10,2) not null default 0,
  dept_nontax numeric(10,2) not null default 0,
  dept_cig numeric(10,2) not null default 0,
  dept_beer_wine numeric(10,2) not null default 0,
  dept_novelty numeric(10,2) not null default 0,
  dept_vape numeric(10,2) not null default 0,
  dept_unknown_upc numeric(10,2) not null default 0,
  -- Fuel
  fuel_unleaded_gallons numeric(10,3) not null default 0,
  fuel_midgrade_gallons numeric(10,3) not null default 0,
  fuel_premium_gallons numeric(10,3) not null default 0,
  fuel_diesel_gallons numeric(10,3) not null default 0,
  fuel_unleaded_sales numeric(10,2) not null default 0,
  fuel_midgrade_sales numeric(10,2) not null default 0,
  fuel_premium_sales numeric(10,2) not null default 0,
  fuel_diesel_sales numeric(10,2) not null default 0,
  -- Lottery/lotto
  lotto_sales numeric(10,2) not null default 0,
  lottery_sales numeric(10,2) not null default 0,
  -- Money order
  money_order_sales numeric(10,2) not null default 0,
  money_order_fee numeric(10,2) not null default 0,
  -- ATM
  atm_total numeric(10,2) not null default 0,
  -- File upload (if scanned from close-till report)
  file_path text,
  raw_ai_response jsonb,
  notes text,
  created_at timestamptz not null default now()
);
alter table till_readings enable row level security;
create policy "tr_own" on till_readings for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Daily close reports — auto-generated end of day, one per store per date
create table daily_close_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  report_date date not null,
  -- Cash flow
  atm_total numeric(10,2) not null default 0,
  checks_total numeric(10,2) not null default 0,
  cash_in_drawer numeric(10,2) not null default 0,
  net_cash numeric(10,2) not null default 0,
  total_cash_flow numeric(10,2) not null default 0,
  -- Expected vs actual
  cash_expected numeric(10,2) not null default 0,
  cash_actual numeric(10,2) not null default 0,
  short_over numeric(10,2) not null default 0,
  -- Department totals
  dept_tax numeric(10,2) not null default 0,
  dept_nontax numeric(10,2) not null default 0,
  dept_cig numeric(10,2) not null default 0,
  dept_beer_wine numeric(10,2) not null default 0,
  dept_novelty numeric(10,2) not null default 0,
  dept_vape numeric(10,2) not null default 0,
  dept_unknown_upc numeric(10,2) not null default 0,
  -- T.Sales
  total_sales numeric(10,2) not null default 0,
  lotto_sales numeric(10,2) not null default 0,
  lottery_sales numeric(10,2) not null default 0,
  fuel_unleaded numeric(10,2) not null default 0,
  fuel_midgrade numeric(10,2) not null default 0,
  fuel_premium numeric(10,2) not null default 0,
  fuel_diesel numeric(10,2) not null default 0,
  money_order_sales numeric(10,2) not null default 0,
  money_order_fee numeric(10,2) not null default 0,
  sales_tax_collected numeric(10,2) not null default 0,
  -- T.Cash flow (payment types)
  credit_card_total numeric(10,2) not null default 0,
  ebt_total numeric(10,2) not null default 0,
  check_total numeric(10,2) not null default 0,
  coupon_total numeric(10,2) not null default 0,
  mac_payout numeric(10,2) not null default 0,
  purchase_paid numeric(10,2) not null default 0,
  lotto_paid numeric(10,2) not null default 0,
  lottery_paid numeric(10,2) not null default 0,
  -- Totals
  total_in numeric(10,2) not null default 0,
  total_out numeric(10,2) not null default 0,
  gross numeric(10,2) not null default 0,
  net numeric(10,2) not null default 0,
  -- Cash flow section
  day_close_total_in numeric(10,2) not null default 0,
  day_close_total_out numeric(10,2) not null default 0,
  mac_in numeric(10,2) not null default 0,
  mac_out numeric(10,2) not null default 0,
  -- Deposit
  store_deposit numeric(10,2) not null default 0,
  mac_deposit numeric(10,2) not null default 0,
  total_deposit numeric(10,2) not null default 0,
  -- Fuel ATG
  atg_unleaded numeric(10,3) not null default 0,
  atg_midgrade numeric(10,3) not null default 0,
  atg_premium numeric(10,3) not null default 0,
  atg_diesel numeric(10,3) not null default 0,
  -- Vendor activities (jsonb array of {vendor,retail,cost,mop})
  vendor_activities jsonb not null default '[]',
  -- Meta
  till_reading_count integer not null default 0,
  generated_at timestamptz not null default now(),
  notes text,
  unique(store_id, report_date)
);
alter table daily_close_reports enable row level security;
create policy "dcr_own" on daily_close_reports for all
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

-- Notifications — smart alerts for owners
create table notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  type text not null, -- 'low_stock' | 'out_of_stock' | 'overstock' | 'price_change' | 'daily_report_ready' | 'reorder_suggestion'
  title text not null,
  message text not null,
  product_id uuid references products(id) on delete cascade,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notif_store on notifications(store_id, is_read, created_at desc);
alter table notifications enable row level security;
create policy "n_own" on notifications for all
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

-- Updated_at triggers
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at=now(); return new; end; $$ language plpgsql;
create trigger stores_upd before update on stores for each row execute function set_updated_at();
create trigger products_upd before update on products for each row execute function set_updated_at();

-- Storage
insert into storage.buckets(id,name,public) values
  ('invoices','invoices',false),
  ('reports','reports',false),
  ('till_readings','till_readings',false)
on conflict(id) do nothing;

create policy "inv_up" on storage.objects for insert with check(bucket_id in ('invoices','reports','till_readings') and (storage.foldername(name))[1] in (select id::text from stores where owner_id=auth.uid()));
create policy "inv_rd" on storage.objects for select using(bucket_id in ('invoices','reports','till_readings') and (storage.foldername(name))[1] in (select id::text from stores where owner_id=auth.uid()));

-- Multi-store: stores already supports multiple per owner_id (remove maybeSingle constraint)
-- employees table already exists
-- No schema changes needed — the stores table already allows multiple rows per owner_id
