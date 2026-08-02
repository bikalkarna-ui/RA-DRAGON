# RYXSOR AI — Smart Store Manager

AI-powered gas station and convenience store management platform. Sits on top of your existing Modisoft POS — upload daily reports and AI automatically handles your P&L, inventory, ordering, and invoices.

## Features

- **Daily Sales Reports** — Upload your Modisoft daily report photo and instantly get your complete P&L
- **Smart Inventory** — Track every product in real time with full movement history
- **AI Ordering Engine** — AI analyzes 30/60/90-day sales velocity and generates purchase orders by vendor
- **Invoice Scanner** — Photograph vendor invoices; AI reads every product, price, and quantity
- **Profit & Loss** — 30-day P&L dashboard with daily trends and AI recommendations
- **Smart Alerts** — Get notified for out-of-stock, price changes, and short drawers
- **Employee Management** — PIN-based time clock, shift tracking, payroll calculations
- **Fuel Margins** — Track cost vs. posted price per grade
- **PWA** — Installable, works offline, push notifications

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Auth + PostgreSQL)
- **Tailwind CSS v3**
- **Recharts** for data visualization
- **lucide-react** for icons
- **PWA** with service worker, push notifications

## Getting Started

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL, anon key, and service role key from [Supabase Dashboard](https://supabase.com).

3. **Set up the database:**
   Run the SQL migrations in order from the `supabase/` directory:
   - `schema.sql` (base schema)
   - `schema_v2_final.sql`
   - `schema_v2_additions.sql`
   - `schema_v3.sql`
   - `schema_daily_reports.sql`
   - `schema_v4_order_history.sql`

4. **Run the dev server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build && npm start
   ```

## Push Notifications (Optional)

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```
Add the public key to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key to `VAPID_PRIVATE_KEY` in your `.env.local`.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── page.tsx         # Landing page (marketing)
│   ├── login/           # Sign in
│   ├── register/        # Sign up
│   ├── home/            # Main dashboard
│   ├── pos/             # Daily report upload & P&L
│   ├── inventory/       # Inventory management
│   ├── invoices/        # Invoice scanning
│   ├── ordering/        # AI ordering engine
│   ├── employees/       # Employee management
│   ├── fuel/            # Fuel margin tracking
│   ├── reports/         # Analytics & trends
│   ├── alerts/          # Smart alerts
│   ├── settings/        # Store & account settings
│   ├── api/             # API routes
│   └── ...
├── components/          # Shared React components
├── hooks/               # Custom React hooks
└── lib/                 # Utilities, Supabase clients
```

## License

© 2026 RYXSOR AI. All rights reserved.
