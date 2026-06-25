import Link from 'next/link';
import { ArrowRight, Check, Zap, Package, FileText, BarChart3, ShoppingCart, Brain, Flame, Star, ChevronRight } from 'lucide-react';

// Dragon SVG logo
function DragonLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dragon head silhouette */}
      <path d="M50 10 C30 10 15 25 15 45 C15 55 20 63 28 68 L25 80 L35 72 C38 73 41 74 44 74 L44 80 L50 74 C56 73 62 70 67 65 C75 58 80 48 78 38 C75 22 65 10 50 10Z" fill="#c0392b" opacity="0.9"/>
      {/* Wing */}
      <path d="M70 35 C80 20 95 15 90 30 C88 38 80 42 70 40Z" fill="#922b21"/>
      <path d="M65 30 C75 12 95 8 88 28 C85 36 75 38 65 35Z" fill="#c0392b" opacity="0.7"/>
      {/* Eye */}
      <ellipse cx="43" cy="42" rx="5" ry="6" fill="#f59e0b"/>
      <ellipse cx="43" cy="42" rx="2" ry="4" fill="#07070a"/>
      {/* Flame breath */}
      <path d="M28 68 C20 75 10 85 15 90 C20 95 30 85 35 78" fill="#f97316" opacity="0.8"/>
      <path d="M25 72 C15 80 8 92 14 95 C18 97 26 88 32 80" fill="#fbbf24" opacity="0.6"/>
      {/* Horns */}
      <path d="M48 12 L42 2 L50 8" fill="#922b21"/>
      <path d="M56 14 L60 3 L55 10" fill="#922b21"/>
      {/* Scales texture */}
      <path d="M35 50 Q40 46 45 50 Q40 54 35 50Z" fill="#922b21" opacity="0.5"/>
      <path d="M45 55 Q50 51 55 55 Q50 59 45 55Z" fill="#922b21" opacity="0.5"/>
      <path d="M38 60 Q43 56 48 60 Q43 64 38 60Z" fill="#922b21" opacity="0.4"/>
    </svg>
  );
}

const FEATURES = [
  {
    icon: Package,
    title: 'Inventory Tracking',
    desc: 'Real-time stock levels. Instant low-stock and overstock alerts. Know exactly what you have before your rep walks in.',
    color: 'from-fire-900/40 to-fire-900/10 border-fire-800/40',
    iconColor: 'text-fire-400',
  },
  {
    icon: Brain,
    title: 'AI Smart Ordering',
    desc: 'AI analyzes your sales velocity and auto-generates separate orders per company — Pepsi, Coke, Frito-Lay, RNK, GG — each order sent to the right rep.',
    color: 'from-gold-900/30 to-gold-900/10 border-gold-800/30',
    iconColor: 'text-gold-400',
  },
  {
    icon: FileText,
    title: 'AI Invoice Scanner',
    desc: 'Snap a photo of any invoice. AI reads it, updates your inventory, detects price changes, and fires alerts — automatically.',
    color: 'from-fire-900/40 to-fire-900/10 border-fire-800/40',
    iconColor: 'text-fire-400',
  },
  {
    icon: BarChart3,
    title: 'Live Sales Tracking',
    desc: 'Real-time dashboard showing every sale as it happens. See today\'s total, by category, by employee — no waiting until end of day.',
    color: 'from-gold-900/30 to-gold-900/10 border-gold-800/30',
    iconColor: 'text-gold-400',
  },
  {
    icon: ShoppingCart,
    title: 'Smart POS',
    desc: 'Barcode scanning, employee PIN login, receipt printing, cash/card/mobile. Runs on any tablet or computer.',
    color: 'from-fire-900/40 to-fire-900/10 border-fire-800/40',
    iconColor: 'text-fire-400',
  },
  {
    icon: Flame,
    title: 'Lottery & Fuel',
    desc: 'Daily lottery entry — scratch-offs, lotto sales, payouts, net. Fuel tracking by grade. Real numbers, not guesses.',
    color: 'from-gold-900/30 to-gold-900/10 border-gold-800/30',
    iconColor: 'text-gold-400',
  },
];

const PLANS = [
  {
    name: 'Starter', price: '$49.99', desc: 'For a single store getting started',
    features: ['1 store location', 'Up to 3 employees', 'POS & inventory', 'Sales reports', 'Invoice scanner'],
    border: 'border-dragon-border',
  },
  {
    name: 'Professional', price: '$129.99', desc: 'The full power of RA Solution',
    features: ['Up to 3 store locations', 'Unlimited employees', 'AI smart ordering', 'Company-wise orders', 'Lottery & fuel tracking', 'Priority support'],
    border: 'border-fire-700', popular: true,
  },
  {
    name: 'Enterprise', price: 'Custom', desc: 'For chains and large operations',
    features: ['Unlimited stores', 'Dedicated support', 'Custom integrations', 'White-label option', 'SLA guarantee'],
    border: 'border-dragon-border',
  },
];

const TESTIMONIALS = [
  { name: 'Khalid Rahman', role: 'Owner, 3 Convenience Stores', text: 'My reps used to show up and I had no idea what I needed. Now RA Solution tells me exactly what to order from who — before they even call.', stars: 5 },
  { name: 'Priya Patel', role: 'Manager, Sunrise Liquor', text: 'The invoice scanner is insane. I used to spend an hour entering invoices. Now I take a photo and walk away. Everything updates automatically.', stars: 5 },
  { name: 'James Wilson', role: 'Owner, Highway Smoke Shop', text: 'The lottery tracking alone is worth it. I finally know my real net from lottery every day instead of guessing at end of month.', stars: 5 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dragon-dark text-obsidian-100 overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-dragon-border/50 bg-dragon-dark/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <DragonLogo size={36} />
            <span className="font-bold text-lg text-white">RA Solution</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Pricing', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-obsidian-400 hover:text-fire-400 transition-colors">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-obsidian-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/register" className="btn-fire">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden bg-scales">
        <div className="absolute inset-0 bg-fire-glow" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-fire-900/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-8 animate-dragon-breathe">
            <DragonLogo size={96} />
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fire-800/50 bg-fire-950/50 px-4 py-1.5 text-sm text-fire-400">
            <Flame className="h-3.5 w-3.5" /> AI-Powered Inventory & POS Platform
          </div>
          <h1 className="mb-6 font-bold text-5xl sm:text-6xl lg:text-7xl leading-tight tracking-tight">
            <span className="text-white">Stop Guessing.</span>
            <br />
            <span className="text-fire-gradient">Start Knowing.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-obsidian-400 leading-relaxed">
            Real-time inventory tracking, AI invoice scanning, company-wise smart ordering, and live sales analytics — all in one platform. Built for convenience stores, gas stations, liquor stores, and smoke shops that want to save time and money.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-fire-700 px-8 py-4 text-base font-bold text-white hover:bg-fire-600 shadow-fire transition-all hover:-translate-y-0.5">
              Launch RA Solution <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 rounded-xl border border-dragon-border px-8 py-4 text-base font-semibold text-obsidian-300 hover:border-fire-800 hover:text-fire-400 transition-all">
              See features <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-dragon-border pt-16">
            {[['Save 3+ hrs', 'Per week on ordering'], ['100%', 'Inventory accuracy'], ['Real-time', 'Sales tracking'], ['AI-powered', 'Everything']].map(([n, l]) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-bold text-fire-400">{n}</p>
                <p className="mt-1 text-sm text-obsidian-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 bg-obsidian-950/50">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Everything your store needs</h2>
            <p className="text-obsidian-400 max-w-2xl mx-auto">Every feature is built around one goal: you always know exactly what's in stock, what's selling, and what to order next.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className={`rounded-xl border bg-gradient-to-br ${f.color} p-6 hover:shadow-fire-sm transition-all`}>
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-obsidian-900/80 ${f.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-white">{f.title}</h3>
                  <p className="text-sm text-obsidian-400 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Ordering highlight */}
          <div className="mt-12 rounded-2xl border border-fire-900/50 bg-gradient-to-r from-fire-950/80 to-obsidian-900/50 p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-fire-900/50 px-3 py-1 text-sm text-fire-400">
                  <Brain className="h-3.5 w-3.5" /> AI Smart Ordering
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">One order per company.<br />Automatically.</h3>
                <p className="text-obsidian-400 mb-6">RA Solution tracks how fast each product sells and generates separate orders for each rep — Pepsi, Coke, Frito-Lay, RNK, GG, McLane, Core-Mark. Each order goes to the right company.</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Pepsi', 'Coca-Cola', 'Frito-Lay', 'RNK', 'GG', 'McLane'].map(v => (
                    <div key={v} className="flex items-center gap-2 text-sm text-obsidian-300">
                      <Check className="h-3.5 w-3.5 text-fire-500 shrink-0" />{v} order
                    </div>
                  ))}
                </div>
              </div>
              <div className="d-card p-5 font-mono text-sm">
                <div className="mb-3 flex items-center gap-2 border-b border-dragon-border pb-3">
                  <Flame className="h-4 w-4 text-fire-500" />
                  <span className="text-obsidian-300 text-xs">AI generating orders…</span>
                </div>
                <div className="space-y-3">
                  {[
                    { co: 'Pepsi', items: 3, est: '$142.50', color: 'text-blue-400' },
                    { co: 'Frito-Lay', items: 5, est: '$89.00', color: 'text-gold-400' },
                    { co: 'RNK', items: 8, est: '$315.20', color: 'text-purple-400' },
                    { co: 'GG', items: 4, est: '$224.00', color: 'text-fire-400' },
                  ].map(o => (
                    <div key={o.co} className="flex items-center justify-between">
                      <span className={o.color}>{o.co}</span>
                      <div className="text-right">
                        <span className="text-obsidian-400 text-xs">{o.items} items · </span>
                        <span className="text-white">{o.est}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-dragon-border text-xs text-fire-500">✓ 4 orders generated — ready to review</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Straightforward pricing</h2>
            <p className="text-obsidian-400">No setup fees. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div key={plan.name} className={`relative rounded-2xl border-2 ${plan.border} bg-dragon-card p-8`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-fire-700 px-4 py-1 text-xs font-bold text-white shadow-fire-sm">
                      <Star className="h-3 w-3 fill-white" /> Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-obsidian-500">{plan.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-fire-gradient">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-obsidian-500 text-sm">/month</span>}
                </div>
                <ul className="mt-6 space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-obsidian-300">
                      <Check className="h-4 w-4 text-fire-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition-all ${plan.popular ? 'btn-fire' : 'border border-dragon-border text-obsidian-300 hover:border-fire-800 hover:text-fire-400'}`}>
                  {plan.price === 'Custom' ? 'Contact us' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 bg-obsidian-950/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-4xl font-bold text-white text-center mb-12">Store owners love it</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="d-card p-6">
                <div className="mb-4 flex">
                  {Array.from({ length: t.stars }).map((_, i) => <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />)}
                </div>
                <p className="text-obsidian-300 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fire-900/50 text-sm font-bold text-fire-400">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-obsidian-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-bold text-white text-center mb-12">Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Does it work with my barcode scanner?', a: 'Yes. Any USB or Bluetooth scanner works immediately — they type the barcode like a keyboard and the POS captures it automatically.' },
              { q: 'How does the company-wise ordering work?', a: 'Assign each product a vendor company (Pepsi, Coke, Frito-Lay, etc.). RA Solution tracks sales velocity and generates one separate order per company — each one showing exactly what to reorder based on how fast it sells.' },
              { q: 'Can I import my existing products?', a: 'Yes — upload a CSV or Excel from any system. AI auto-maps the columns even if they have different names. Migration Center walks you through it step by step.' },
              { q: 'How does invoice scanning work?', a: 'Take a photo or upload a PDF of any vendor invoice. AI extracts every line item, matches products to your inventory, flags price changes, and updates stock — you review and confirm.' },
              { q: 'Can I track lottery separately from sales?', a: 'Yes. Lottery has its own daily entry page — scratch-off sales, lotto terminal sales, scratch-off payouts, lotto payouts — with net calculated automatically.' },
              { q: 'What about fuel?', a: 'Daily fuel entry by grade (Regular, Plus, Premium, Diesel) with gallons and price per gallon. Total gallons and sales calculated automatically.' },
            ].map(faq => (
              <div key={faq.q} className="d-card p-5">
                <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-obsidian-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-scales">
        <div className="mx-auto max-w-3xl text-center">
          <DragonLogo size={64} />
          <h2 className="mt-6 text-4xl font-bold text-white mb-4">Ready to save time?</h2>
          <p className="text-obsidian-400 mb-8">Join store owners who know exactly what's in stock, what's selling, and what to order.</p>
          <Link href="/register" className="btn-fire text-base px-8 py-4 shadow-fire">
            Download RA Solution <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dragon-border py-8 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <DragonLogo size={28} />
            <span className="font-bold text-white">RA Solution</span>
          </div>
          <p className="text-sm text-obsidian-600">© {new Date().getFullYear()} RA Solution. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
