-- Daily closing checklist
create table if not exists daily_checklists (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  report_date date not null,
  store_close_done boolean default false,
  lottery_counted boolean default false,
  scratch_verified boolean default false,
  safe_drops_entered boolean default false,
  paid_outs_entered boolean default false,
  deposit_prepared boolean default false,
  invoices_uploaded boolean default false,
  employees_clocked_out boolean default false,
  is_closed boolean default false,
  closed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(store_id, report_date)
);
alter table daily_checklists enable row level security;
drop policy if exists "dc_own" on daily_checklists;
create policy "dc_own" on daily_checklists for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Business timeline events
create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  event_date date not null,
  event_time timestamptz not null default now(),
  type text not null,
  title text not null,
  description text,
  amount numeric(12,2),
  employee_name text,
  reference_id uuid,
  created_at timestamptz default now()
);
create index if not exists te_store_date on timeline_events(store_id, event_date desc);
alter table timeline_events enable row level security;
drop policy if exists "te_own" on timeline_events;
create policy "te_own" on timeline_events for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Shrink/waste events
create table if not exists shrink_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  type text not null default 'waste',
  quantity numeric(10,2) not null,
  unit_cost numeric(10,2) default 0,
  total_cost numeric(10,2) default 0,
  employee_name text,
  notes text,
  created_at timestamptz default now()
);
alter table shrink_events enable row level security;
drop policy if exists "se_own" on shrink_events;
create policy "se_own" on shrink_events for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Add columns to products
alter table products add column if not exists backroom_qty integer default 0;
alter table products add column if not exists shelf_qty integer default 0;
alter table products add column if not exists avg_cost numeric(10,2);
alter table products add column if not exists units_sold_today integer default 0;
alter table products add column if not exists units_sold_week integer default 0;
alter table products add column if not exists units_sold_month integer default 0;
alter table products add column if not exists expected_out_date date;

-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique(user_id)
);
alter table push_subscriptions enable row level security;
drop policy if exists "ps_own" on push_subscriptions;
create policy "ps_own" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shrink events (if not exists from earlier)
create table if not exists shrink_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  type text not null default 'waste',
  quantity numeric(10,2) not null,
  unit_cost numeric(10,2) default 0,
  total_cost numeric(10,2) default 0,
  employee_name text,
  notes text,
  created_at timestamptz default now()
);
alter table shrink_events enable row level security;
drop policy if exists "se_own" on shrink_events;
create policy "se_own" on shrink_events for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));
