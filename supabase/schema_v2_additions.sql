-- RA Solution v4 — Additive migrations (run after existing schema.sql)
-- These ADD new tables without dropping anything existing

-- ── Inventory movements — the foundation of accurate inventory ──────────────
create table if not exists inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  product_name  text not null,
  type          text not null, -- 'sale' | 'receive' | 'waste' | 'adjustment' | 'return' | 'transfer'
  quantity      numeric(10,2) not null, -- positive = in, negative = out
  quantity_before numeric(10,2) not null default 0,
  quantity_after  numeric(10,2) not null default 0,
  unit_cost     numeric(10,2),
  unit_price    numeric(10,2),
  reference_type text,  -- 'invoice' | 'sale' | 'daily_report' | 'manual'
  reference_id  uuid,   -- invoice_id or sale_id
  reference_label text, -- "Invoice #1234" or "Register 1" or "Manual"
  employee_name text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists im_product on inventory_movements(product_id, created_at desc);
create index if not exists im_store   on inventory_movements(store_id, created_at desc);
create index if not exists im_type    on inventory_movements(store_id, type, created_at desc);
alter table inventory_movements enable row level security;
create policy "im_own" on inventory_movements for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- ── Employee time clock ──────────────────────────────────────────────────────
create table if not exists time_clock (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  employee_id  uuid not null references employees(id) on delete cascade,
  employee_name text not null,
  clock_in     timestamptz not null default now(),
  clock_out    timestamptz,
  hours_worked numeric(6,2),
  break_minutes integer not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists tc_store on time_clock(store_id, clock_in desc);
create index if not exists tc_emp   on time_clock(employee_id, clock_in desc);
alter table time_clock enable row level security;
create policy "tc_own" on time_clock for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- ── Purchase orders ──────────────────────────────────────────────────────────
create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  vendor_name     text not null,
  vendor_company  text,
  po_number       text,
  status          text not null default 'draft', -- draft | sent | received | partial | cancelled
  ai_generated    boolean not null default false,
  ai_notes        text,
  subtotal        numeric(10,2) not null default 0,
  tax             numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  expected_date   date,
  received_date   date,
  notes           text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  received_at     timestamptz
);
create index if not exists po_store on purchase_orders(store_id, created_at desc);
alter table purchase_orders enable row level security;
create policy "po_own" on purchase_orders for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

create table if not exists purchase_order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references purchase_orders(id) on delete cascade,
  product_id     uuid references products(id) on delete set null,
  product_name   text not null,
  barcode        text,
  sku            text,
  department     text,
  current_stock  integer not null default 0,
  order_qty      integer not null default 0,
  received_qty   integer not null default 0,
  case_pack      integer not null default 1,
  unit_cost      numeric(10,2) not null default 0,
  retail_price   numeric(10,2) not null default 0,
  line_total     numeric(10,2) not null default 0,
  days_of_supply numeric(6,1),
  velocity_30d   numeric(10,2) not null default 0, -- units sold last 30 days
  velocity_60d   numeric(10,2) not null default 0,
  velocity_90d   numeric(10,2) not null default 0,
  ai_reason      text,
  status         text not null default 'pending' -- pending | received | partial | cancelled
);
alter table purchase_order_items enable row level security;
create policy "poi_own" on purchase_order_items for all
  using (order_id in (select po.id from purchase_orders po join stores s on s.id=po.store_id where s.owner_id=auth.uid()))
  with check (order_id in (select po.id from purchase_orders po join stores s on s.id=po.store_id where s.owner_id=auth.uid()));

-- ── Shrink / waste tracking ──────────────────────────────────────────────────
create table if not exists shrink_events (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  product_id   uuid references products(id) on delete set null,
  product_name text not null,
  type         text not null, -- 'theft' | 'damage' | 'expired' | 'vendor' | 'other'
  quantity     numeric(10,2) not null,
  unit_cost    numeric(10,2) not null default 0,
  total_cost   numeric(10,2) not null default 0,
  employee_name text,
  notes        text,
  created_at   timestamptz not null default now()
);
alter table shrink_events enable row level security;
create policy "se_own" on shrink_events for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- ── Price history ────────────────────────────────────────────────────────────
create table if not exists price_history (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  product_name text not null,
  old_cost     numeric(10,2),
  new_cost     numeric(10,2),
  old_price    numeric(10,2),
  new_price    numeric(10,2),
  old_margin   numeric(6,2),
  new_margin   numeric(6,2),
  source       text, -- 'invoice' | 'manual'
  invoice_id   uuid references invoices(id) on delete set null,
  vendor_name  text,
  created_at   timestamptz not null default now()
);
create index if not exists ph_product on price_history(product_id, created_at desc);
alter table price_history enable row level security;
create policy "ph_own" on price_history for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- ── Audit log ────────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);
create index if not exists al_store on audit_logs(store_id, created_at desc);
alter table audit_logs enable row level security;
create policy "al_own" on audit_logs for all
  using (store_id in (select id from stores where owner_id=auth.uid()));

-- ── Add missing columns to existing tables ──────────────────────────────────
alter table products add column if not exists image_url     text;
alter table products add column if not exists department    text;
alter table products add column if not exists category      text;
alter table products add column if not exists case_pack     integer not null default 1;
alter table products add column if not exists reorder_qty   integer not null default 0;
alter table products add column if not exists location      text;
alter table products add column if not exists last_received_at timestamptz;
alter table products add column if not exists last_invoice_id  uuid;
alter table products add column if not exists notes         text;

alter table employees add column if not exists hourly_rate   numeric(8,2);
alter table employees add column if not exists permissions   jsonb not null default '{}';
alter table employees add column if not exists phone         text;

-- ── Storage bucket for product images ───────────────────────────────────────
insert into storage.buckets(id,name,public)
  values('product-images','product-images',true)
  on conflict(id) do nothing;

create policy "pi_pub_rd" on storage.objects for select
  using(bucket_id = 'product-images');
create policy "pi_up" on storage.objects for insert
  with check(bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (select id::text from stores where owner_id=auth.uid()));
