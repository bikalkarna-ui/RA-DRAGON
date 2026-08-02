-- Order History feature: manual order log (backup for when there's no scanned
-- invoice yet — phone orders, cash-and-carry runs, etc.)
-- Scanned invoices (invoice_items) and AI/manual purchase orders
-- (purchase_order_items) already carry what's needed — this table only fills
-- the gap for orders that never get a scanned invoice.

create table if not exists manual_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  item_name text not null,
  department text,                -- matches the DEPARTMENTS list used in Inventory (e.g. 'Tobacco/CIG')
  qty numeric(10,2) not null default 0,
  unit_cost numeric(10,2),
  vendor_name text,
  order_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists manual_orders_store on manual_orders(store_id, order_date desc);
alter table manual_orders enable row level security;
drop policy if exists "mo_own" on manual_orders;
create policy "mo_own" on manual_orders for all
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
