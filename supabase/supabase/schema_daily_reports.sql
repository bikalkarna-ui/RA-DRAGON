-- Daily Reports System - run this in Supabase SQL Editor

-- Main daily report - one per store per date
create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  report_date date not null,
  status text not null default 'in_progress', -- in_progress | completed | needs_review
  
  -- Gross figures
  gross_sales numeric(12,2) default 0,
  net_sales numeric(12,2) default 0,
  fuel_sales numeric(12,2) default 0,
  inside_sales numeric(12,2) default 0,
  merchandise_sales numeric(12,2) default 0,
  lottery_sales numeric(12,2) default 0,
  scratch_sales numeric(12,2) default 0,
  
  -- Payouts
  lottery_payouts numeric(12,2) default 0,
  scratch_payouts numeric(12,2) default 0,
  
  -- Taxes & adjustments
  taxes numeric(12,2) default 0,
  discounts numeric(12,2) default 0,
  refunds numeric(12,2) default 0,
  
  -- Transaction info
  customers integer default 0,
  transactions integer default 0,
  avg_ticket numeric(8,2) default 0,
  
  -- Fuel
  fuel_gallons numeric(10,3) default 0,
  fuel_unleaded_gallons numeric(10,3) default 0,
  fuel_midgrade_gallons numeric(10,3) default 0,
  fuel_premium_gallons numeric(10,3) default 0,
  fuel_diesel_gallons numeric(10,3) default 0,
  fuel_unleaded_sales numeric(12,2) default 0,
  fuel_midgrade_sales numeric(12,2) default 0,
  fuel_premium_sales numeric(12,2) default 0,
  fuel_diesel_sales numeric(12,2) default 0,
  
  -- Department sales (jsonb for flexibility)
  department_sales jsonb default '{}',
  
  -- Payment methods
  cash_sales numeric(12,2) default 0,
  credit_sales numeric(12,2) default 0,
  debit_sales numeric(12,2) default 0,
  ebt_sales numeric(12,2) default 0,
  check_sales numeric(12,2) default 0,
  money_order_sales numeric(12,2) default 0,
  atm_sales numeric(12,2) default 0,
  
  -- Cash management
  safe_drops numeric(12,2) default 0,
  safe_loans numeric(12,2) default 0,
  paid_ins numeric(12,2) default 0,
  paid_outs numeric(12,2) default 0,
  beginning_till numeric(12,2) default 0,
  ending_till numeric(12,2) default 0,
  expected_cash numeric(12,2) default 0,
  actual_cash numeric(12,2) default 0,
  cash_deposit numeric(12,2) default 0,
  drawer_difference numeric(12,2) default 0,
  store_difference numeric(12,2) default 0,
  
  -- Lottery settlement
  lottery_settlement numeric(12,2) default 0,
  lottery_commission numeric(12,2) default 0,
  
  -- Profit estimate
  profit_estimate numeric(12,2) default 0,
  
  -- AI metadata
  ai_notes text,
  store_notes text,
  validation_warnings jsonb default '[]',
  ai_validated boolean default false,
  
  -- Timestamps
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- One report per store per date
  unique(store_id, report_date)
);

alter table daily_reports enable row level security;
drop policy if exists "dr_own" on daily_reports;
create policy "dr_own" on daily_reports for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Report uploads - multiple files per daily report
create table if not exists report_uploads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  daily_report_id uuid references daily_reports(id) on delete cascade,
  report_date date not null,
  report_type text not null, -- store_close | till | lottery | scratch | department | safe_drop | paid_out | paid_in | plu | register | summary | unknown
  file_name text,
  file_size integer,
  status text not null default 'processing', -- processing | completed | failed
  
  -- Raw extracted data from AI
  raw_extraction jsonb default '{}',
  
  -- Parsed structured data
  parsed_data jsonb default '{}',
  
  -- What this upload contributed to the daily report
  contribution jsonb default '{}',
  
  ai_notes text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table report_uploads enable row level security;
drop policy if exists "ru_own" on report_uploads;
create policy "ru_own" on report_uploads for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));

-- Register reports - per register per day
create table if not exists register_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  daily_report_id uuid references daily_reports(id) on delete cascade,
  report_date date not null,
  register_number text not null default '1',
  
  gross_sales numeric(12,2) default 0,
  net_sales numeric(12,2) default 0,
  cash_sales numeric(12,2) default 0,
  credit_sales numeric(12,2) default 0,
  debit_sales numeric(12,2) default 0,
  ebt_sales numeric(12,2) default 0,
  
  expected_cash numeric(12,2) default 0,
  actual_cash numeric(12,2) default 0,
  drawer_difference numeric(12,2) default 0,
  
  safe_drops numeric(12,2) default 0,
  paid_outs numeric(12,2) default 0,
  paid_ins numeric(12,2) default 0,
  
  transactions integer default 0,
  created_at timestamptz not null default now()
);

alter table register_reports enable row level security;
drop policy if exists "rr_own" on register_reports;
create policy "rr_own" on register_reports for all
  using (store_id in (select id from stores where owner_id=auth.uid()))
  with check (store_id in (select id from stores where owner_id=auth.uid()));
