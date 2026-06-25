# RA Solution — Dragon Edition 🐉

AI-powered POS & store management for convenience stores.
Dragon theme: obsidian black, blood red, fire gold.

## Features

1. **Live Sales Dashboard** — auto-refreshes every 30 seconds, hourly chart, category breakdown
2. **AI Smart Ordering** — one order per vendor (Pepsi, Coke, Frito-Lay, RNK, GG, McLane, Core-Mark), AI analyzes sales velocity
3. **Inventory Tracking** — low stock alerts, overstock alerts, filter by vendor, min/max quantities
4. **AI Invoice Scanner** — PDF/photo, price change alerts, 30% markup suggestions
5. **Invoice Tracking** — full history with price change badges
6. **Lottery & Fuel** — daily manual entry, scratch-off + lotto terminal + payouts, net auto-calculated, fuel by grade
7. **Net Sales Calculator** — Reports page has adjustable line items (scratch-off deduction, lotto paid out, etc.) to get real net total
8. **POS** — barcode scanner, employee PIN with numpad, 4 payment methods, receipt
9. **Employees** — cashier/manager PINs, activate/deactivate
10. **Migration Center** — CSV/Excel import with AI column mapping

## Setup

### 1. Run SQL
Paste `supabase/schema.sql` in Supabase SQL Editor → Run

### 2. Vercel Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://bemouimlxnsemdqwbpkm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. Deploy
Push to GitHub → Vercel → Add 4 env vars → Deploy

### 4. First login
Register → store auto-created → all vendor companies pre-loaded
