'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowRight, BarChart3, Package, Brain, FileText,
  TrendingUp, Bell, Users, Check, Mail, Phone,
  Shield, Zap, Clock, Star, Menu, X, ScanLine, Fuel, Cigarette,
  Building2, ChevronDown
} from 'lucide-react';
import { ReviewsSection } from '@/components/landing/reviews-section';
import { ChatWidget } from '@/components/landing/chat-widget';

// Signature hero element — visualizes the product's actual mechanism: a photographed
// daily report gets scanned and turned into a structured, categorized P&L in seconds.
// This is deliberately built from the real thing RYXSOR does, not a generic dashboard mock.
function ScanVisual() {
  const rows = [
    { label: 'Fuel', value: '$4,218.60', icon: Fuel, color: '#D97706' },
    { label: 'Tobacco / CIG', value: '$1,940.15', icon: Cigarette, color: '#7C3AED' },
    { label: 'Grocery & Snacks', value: '$2,105.40', icon: Package, color: '#2563EB' },
    { label: 'Lottery', value: '$612.00', icon: Star, color: '#059669' },
  ];
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-3xl border border-gray-200 bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04),0_24px_64px_rgba(16,24,40,0.10)] overflow-hidden">

        {/* Left: the raw report */}
        <div className="relative bg-gray-900 p-6 sm:p-7 overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-4">Photo of your report</p>
          <div className="space-y-2 font-mono text-[11px] leading-relaxed text-gray-400">
            <p className="text-gray-300">** DAILY CLOSE — SHIFT 2 **</p>
            <p>REG SALES ....... 8,876.15</p>
            <p>FUEL GALLONS .... 1,104.2</p>
            <p>DEPT 04 TOBACCO . 1,940.15</p>
            <p>DEPT 09 GROCERY . 2,105.40</p>
            <p>LOTTERY NET ..... 612.00</p>
            <p>DRAWER COUNT .... 240.00</p>
            <p className="text-gray-600">— end of report —</p>
          </div>
          {/* scanning beam */}
          <div className="scan-beam pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-accent/40 to-transparent" />
        </div>

        {/* Right: structured output */}
        <div className="p-6 sm:p-7 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/10">
              <Brain className="h-3 w-3 text-accent" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Structured instantly</p>
          </div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.label} className="reveal-row flex items-center justify-between" style={{ animationDelay: `${0.5 + i * 0.18}s` }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${r.color}14` }}>
                    <r.icon className="h-4 w-4" style={{ color: r.color }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{r.label}</span>
                </div>
                <span className="num text-sm font-bold text-gray-900">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="reveal-row mt-4 pt-4 border-t border-gray-100 flex items-center justify-between" style={{ animationDelay: '1.3s' }}>
            <span className="text-sm font-black text-gray-900">Net for the day</span>
            <span className="num text-base font-black text-accent">$8,876.15</span>
          </div>
        </div>
      </div>

      {/* Floating scan chip */}
      <div className="scan-chip absolute left-1/2 -translate-x-1/2 -top-4 sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-xs font-bold px-3.5 py-2 shadow-lg">
        <ScanLine className="h-3.5 w-3.5 text-accent2" /> AI reading report…
      </div>

      <style>{`
        @keyframes scanSweep { 0%,15%{transform:translateY(-64px);opacity:0} 20%{opacity:1} 55%{transform:translateY(280px);opacity:1} 62%,100%{opacity:0} }
        .scan-beam { animation: scanSweep 3.2s ease-in-out infinite; }
        @keyframes revealRow { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        .reveal-row { animation: revealRow 0.5s ease both; animation-iteration-count: 1; }
        @keyframes chipPulse { 0%,100%{opacity:0.85} 50%{opacity:1} }
        .scan-chip { animation: chipPulse 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .scan-beam, .reveal-row, .scan-chip { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-5">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left gap-4">
        <span className="font-bold text-gray-900 text-base">{q}</span>
        <ChevronDown className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-sm text-gray-500 leading-relaxed mt-3 pr-8">{a}</p>}
    </div>
  );
}

// Small stylized "screen" used in the alternating feature sections — deliberately a
// simplified mock, not a real screenshot, so it never goes stale as the app changes.
function MiniPreview({ kind }: { kind: 'pnl' | 'ordering' | 'fuel' }) {
  if (kind === 'pnl') {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(16,24,40,0.04),0_16px_40px_rgba(16,24,40,0.08)] p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Today's P&L</p>
        <div className="flex items-end gap-1.5 h-24 mb-3">
          {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-accent/70" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Net sales</span>
          <span className="num font-black text-gray-900">$8,876.15</span>
        </div>
      </div>
    );
  }
  if (kind === 'ordering') {
    const rows = [
      { name: 'Marlboro Red 20ct', qty: 12, tag: 'reorder' },
      { name: 'Bud Light 24oz', qty: 24, tag: 'reorder' },
      { name: 'Monster Energy', qty: 18, tag: 'ok' },
    ];
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(16,24,40,0.04),0_16px_40px_rgba(16,24,40,0.08)] p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">AI suggested order</p>
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.name} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">{r.name}</span>
              <span className={`chip ${r.tag === 'reorder' ? 'chip-red' : 'chip-green'}`}>{r.tag === 'reorder' ? `+${r.qty} units` : 'in stock'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_2px_8px_rgba(16,24,40,0.04),0_16px_40px_rgba(16,24,40,0.08)] p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Fuel margin, today</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[{ g: 'Regular', m: '$0.31' }, { g: 'Plus', m: '$0.34' }, { g: 'Premium', m: '$0.38' }].map(f => (
          <div key={f.g} className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-1">{f.g}</p>
            <p className="num font-black text-gray-900">{f.m}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      createClient().auth.getSession().then(({ data }: any) => {
        if (data?.session) window.location.href = '/home';
      });
    } catch {}
  }, []);

  const features = [
    { icon: BarChart3, title: 'Daily Sales Reports',     desc: 'Upload your Modisoft daily report and instantly get your complete P&L — sales, cash flow, short/over, and department breakdown. Automated every day.',           color: '#C0392B', bg: '#FEF2F2' },
    { icon: Package,   title: 'Smart Inventory',         desc: 'Track every product in real time. Every delivery, sale, and adjustment is logged with a full history. Know exactly what you have, what sold, and what to order.',  color: '#2563EB', bg: '#EFF6FF' },
    { icon: Brain,     title: 'AI Ordering Engine',      desc: 'AI analyzes 30, 60, and 90-day sales velocity per product and generates exact purchase orders by vendor. Never overstock or run out again.',                         color: '#7C3AED', bg: '#F5F3FF' },
    { icon: FileText,  title: 'Invoice Scanner',         desc: 'Photograph vendor invoices with your phone. AI reads every product, price, and quantity — updates your inventory and flags any price changes automatically.',         color: '#DB2777', bg: '#FDF2F8' },
    { icon: TrendingUp,title: 'Profit & Loss',           desc: '30-day P&L dashboard with daily trends, best and worst days, department performance, and AI-powered business recommendations tailored to your store.',               color: '#059669', bg: '#ECFDF5' },
    { icon: Bell,      title: 'Smart Alerts',            desc: 'Get notified when products go out of stock, when vendor prices change, and when your drawer is short. Every alert includes an AI recommendation.',                   color: '#D97706', bg: '#FFFBEB' },
    { icon: Users,     title: 'Employee Management',     desc: 'PIN-based time clock, shift tracking, payroll calculations, and CSV export. Manage your entire team from one place.',                                               color: '#0891B2', bg: '#ECFEFF' },
    { icon: Shield,    title: 'Enterprise Security',     desc: 'Bank-grade encryption, automatic backups, and complete audit logs. Your data is safe and accessible from any device, anywhere.',                                   color: '#374151', bg: '#F9FAFB' },
  ];

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      period: '',
      desc: 'Perfect to get started',
      color: 'border-gray-200',
      btn: 'bg-gray-900 text-white hover:bg-gray-700',
      features: ['1 store location', 'Daily report uploads', 'Basic inventory tracking', 'Invoice scanning (5/month)', 'Email support'],
      popular: false,
    },
    {
      name: 'Pro',
      price: '$149',
      period: '/month',
      desc: 'For serious store operators',
      color: 'border-accent ring-2 ring-accent',
      btn: 'bg-accent text-white hover:bg-red-700',
      features: ['Up to 3 store locations', 'Unlimited daily reports', 'Full inventory with history', 'Unlimited invoice scanning', 'AI ordering engine', 'Employee time clock', 'Profit & Loss reports', 'Priority support', '1 month FREE trial'],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '$245.99',
      period: '/month',
      desc: 'For multi-location operators',
      color: 'border-gray-800 bg-gray-900',
      btn: 'bg-white text-gray-900 hover:bg-gray-100',
      dark: true,
      features: ['Unlimited store locations', 'Corporate dashboard', 'Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'White-label option', 'API access', 'SLA guarantee', '1 month FREE trial'],
      popular: false,
    },
  ];


  return (
    <div className="min-h-screen bg-white">
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'RYXSOR AI',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, iOS, Android',
            description:
              'AI-powered gas station and convenience store management platform. Auto-read daily reports, track inventory, manage employees, and generate P&L.',
            offers: [
              { '@type': 'Offer', name: 'Starter', price: '0', priceCurrency: 'USD', description: '1 store location, daily reports, basic inventory' },
              { '@type': 'Offer', name: 'Pro', price: '149', priceCurrency: 'USD', description: 'Up to 3 locations, AI ordering, employee time clock, P&L reports' },
              { '@type': 'Offer', name: 'Enterprise', price: '245.99', priceCurrency: 'USD', description: 'Unlimited locations, corporate dashboard, API access' },
            ],
            publisher: { '@type': 'Organization', name: 'RYXSOR AI', foundingDate: '2026', founder: { '@type': 'Person', name: 'RA' } },
          }),
        }}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-black text-xl font-display">R</div>
            <div>
              <span className="font-display font-bold text-gray-900 text-xl">RYXSOR AI</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-2">by RA</span>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Features</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
            <a href="#about" className="text-sm text-gray-600 hover:text-gray-900 font-medium">About</a>
            <a href="#contact" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Contact</a>
            <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-gray-900">Sign In</Link>
            <Link href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-white font-bold text-sm px-5 py-2.5 hover:bg-red-700 transition-colors">
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
            <a href="#features" className="block text-sm text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Pricing</a>
            <a href="#about" className="block text-sm text-gray-700 py-2" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#contact" className="block text-sm text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Contact</a>
            <Link href="/login" className="block text-sm font-semibold text-gray-700 py-2">Sign In</Link>
            <Link href="/register" className="block text-center rounded-xl bg-accent text-white font-bold text-sm px-5 py-3">
              Start Free Trial
            </Link>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Link href="/terms" className="text-xs text-gray-400">Terms</Link>
              <Link href="/privacy" className="text-xs text-gray-400">Privacy</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 sm:pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-2 mb-8">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-bold text-accent tracking-wide uppercase">AI-Powered Gas Station Management</span>
        </div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-gray-900 leading-[1.05] mb-6">
          Your report becomes<br />
          your <span className="text-accent">P&amp;L in seconds.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          RYXSOR AI sits on top of your existing Modisoft POS. Upload your daily report and AI automatically handles your P&amp;L, inventory, ordering, and invoices — so you can focus on your customers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent text-white font-bold text-lg px-10 py-5 hover:bg-red-700 active:scale-95 transition-all shadow-[0_2px_8px_rgba(192,57,43,0.18),0_8px_20px_rgba(192,57,43,0.16)] hover:shadow-[0_4px_12px_rgba(192,57,43,0.22),0_12px_32px_rgba(192,57,43,0.2)]">
            Launch RYXSOR AI <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-base px-8 py-4 hover:border-gray-300 hover:bg-gray-50 transition-all">
            Sign in to your store
          </Link>
        </div>

        {/* Signature visual */}
        <ScanVisual />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 mt-12">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />Free to start</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />Works with Modisoft</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />No credit card needed</span>
        </div>
      </section>


      {/* Trust pillars */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 text-center">
          {[
            { title: 'Zero manual entry', desc: 'Photograph a report or invoice — the AI reads every line so you don\u2019t type numbers twice.' },
            { title: 'Runs 24/7', desc: 'Alerts, ordering, and P&L update the moment new data comes in — no clocking in required.' },
            { title: 'Built on real shifts', desc: 'Every screen was shaped by an actual gas station counter, not a generic retail template.' },
          ].map(p => (
            <div key={p.title}>
              <h3 className="font-display font-bold text-gray-900 text-lg mb-1.5">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">Everything your store needs</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">Built specifically for gas stations and convenience stores. Every feature is designed around how your business actually works.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(f => (
            <div key={f.title} className="rounded-2xl border border-gray-100 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.04)] hover:shadow-[0_4px_12px_rgba(16,24,40,0.06),0_12px_32px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: f.bg }}>
                <f.icon className="h-6 w-6" style={{ color: f.color }} />
              </div>
              <h3 className="font-black text-gray-900 text-base mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What makes us different */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">What makes RYXSOR AI different</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">We're not another generic inventory app. Here's what actually sets us apart.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { title: 'Works with your POS, not against it', desc: "Most tools ask you to switch systems entirely. RYXSOR AI sits on top of Modisoft — you keep what you already use and know." },
            { title: 'AI reads your paperwork, not the other way around', desc: 'Photograph an invoice or upload your daily report — the AI extracts every number. No manual data entry, no learning a new interface.' },
            { title: 'Built for gas stations specifically', desc: "Lottery book tracking, fuel margin analysis, vendor-based ordering — features generic retail software doesn't have, because it wasn't built for this industry." },
            { title: 'Founder who actually worked this job', desc: "Built by someone who grew up working in gas stations, not a generic SaaS template repurposed for a new market." },
          ].map(d => (
            <div key={d.title} className="rounded-2xl bg-gray-50 border border-gray-100 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <h3 className="font-black text-gray-900 text-base mb-2">{d.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-lg text-gray-500">Get your store running on RYXSOR AI in minutes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '1', icon: Clock, title: 'Connect your store',  desc: 'Sign up and import your product catalog via CSV. Takes 10 minutes.' },
              { step: '2', icon: FileText, title: 'Upload daily reports', desc: 'Every day, screenshot your Modisoft report and upload it. AI reads everything.' },
              { step: '3', icon: TrendingUp, title: 'Watch it work',    desc: 'Your P&L, inventory, ordering, and alerts all update automatically. Nothing manual.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white font-black text-xl mx-auto mb-4">{s.step}</div>
                <h3 className="font-black text-gray-900 text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep feature showcase — alternating detail sections */}
      <section className="max-w-5xl mx-auto px-6 py-24 space-y-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-3">Profit & Loss</p>
            <h3 className="font-display text-3xl font-bold text-gray-900 mb-4">Know today's numbers today, not next week</h3>
            <ul className="space-y-3">
              {['Upload your daily report photo — sales, fuel, and department totals populate automatically', 'See short/over, best and worst days, and department trends without opening a spreadsheet', 'AI flags anything unusual — a short drawer, a slow department — the moment it happens'].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <MiniPreview kind="pnl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
          <div className="sm:order-2">
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-3">AI Ordering</p>
            <h3 className="font-display text-3xl font-bold text-gray-900 mb-4">Never guess what to reorder again</h3>
            <ul className="space-y-3">
              {['AI reads 30/60/90-day sales velocity per product and tells you exactly what to reorder, and how much', 'Purchase orders are grouped by vendor, ready to send in one tap', 'Order History keeps every past order — invoice-scanned or manual — searchable by category'].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:order-1"><MiniPreview kind="ordering" /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-3">Fuel Margins</p>
            <h3 className="font-display text-3xl font-bold text-gray-900 mb-4">Fuel is your thinnest margin — watch it like one</h3>
            <ul className="space-y-3">
              {['Track cost vs. posted price per grade, updated with every delivery', 'See gallons sold and margin dollars side by side, not buried in a POS report', 'Catch a pricing mistake before it costs you a full shift of margin'].map(t => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <MiniPreview kind="fuel" />
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">Questions store owners actually ask</h2>
          </div>
          <div>
            <FaqItem q="Does this replace my Modisoft POS?" a="No — RYXSOR AI sits on top of it. You keep ringing up sales on Modisoft exactly like you do now. RYXSOR reads your daily reports and invoices and turns them into P&L, inventory, and ordering data." />
            <FaqItem q="How long does setup take?" a="Most owners are running within a day. Sign up, import your product list (CSV or manual), and start uploading daily reports — there's no hardware to install." />
            <FaqItem q="What if I have more than one store?" a="RYXSOR supports multiple locations under one account, with role-based access so managers and employees only see what's relevant to them." />
            <FaqItem q="Can employees clock in without seeing financials?" a="Yes. Owner, Manager, and Employee roles each see a different, PIN-gated view — cashiers get the time clock and cashier actions, not your P&L." />
            <FaqItem q="Does it track lottery and tobacco separately?" a="Yes — lottery, tobacco, and every other department are tracked as their own categories throughout reports, inventory, and ordering." />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <ReviewsSection />

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-500">Start free. Upgrade when you're ready. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map(plan => (
              <div key={plan.name}
                className={`rounded-2xl border-2 p-8 relative shadow-[0_2px_8px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)] ${plan.color} ${plan.dark ? 'text-white' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-xl font-black mb-1 ${plan.dark ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.dark ? 'text-gray-400' : 'text-gray-500'}`}>{plan.desc}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className={`text-4xl font-black ${plan.dark ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                  <span className={`text-sm mb-1 ${plan.dark ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
                </div>
                <Link href="/register"
                  className={`block w-full text-center rounded-xl font-bold text-sm py-3 mb-6 transition-colors ${plan.btn}`}>
                  Get started free
                </Link>
                <ul className="space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.dark ? 'text-green-400' : 'text-green-500'}`} />
                      <span className={`text-sm ${plan.dark ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-4xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">Built by people who understand your business</h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              RYXSOR AI was founded by RA, who grew up working in gas stations and convenience stores. We built the software we always wished existed — one that works with your existing POS, not against it.
            </p>
            <p className="text-gray-500 leading-relaxed mb-4">
              Our mission is simple: give every gas station owner the same tools that big chains use, at a price that works for independent operators.
            </p>
            <p className="text-gray-500 leading-relaxed">
              We're based in Texas, and we're just getting started — built and run by someone who's actually worked the counter.
            </p>
          </div>
          <div className="bg-gray-900 rounded-3xl p-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-white font-black text-4xl mx-auto mb-6">R</div>
            <p className="text-white font-black text-2xl mb-1">RYXSOR AI</p>
            <p className="text-gray-400 text-sm mb-4">Founded by RA</p>
            <p className="text-gray-400 text-xs">© 2026 RYXSOR AI. All rights reserved.</p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-gray-900 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-white mb-4">Get in touch</h2>
            <p className="text-gray-400 text-lg">We'd love to hear from you. Reach out any time.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <a href="mailto:bikalkarna@gmail.com"
              className="rounded-2xl bg-gray-800 p-6 text-center hover:bg-gray-700 transition-colors group">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 mx-auto mb-4">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <p className="font-bold text-white mb-1">Email</p>
              <p className="text-gray-400 text-sm break-all">bikalkarna@gmail.com</p>
            </a>
            <div className="rounded-2xl bg-gray-800 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 mx-auto mb-4">
                <Clock className="h-6 w-6 text-blue-400" />
              </div>
              <p className="font-bold text-white mb-1">Support Hours</p>
              <p className="text-gray-400 text-sm">Monday – Friday<br />9 AM – 6 PM CST</p>
            </div>
            <div className="rounded-2xl bg-gray-800 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20 mx-auto mb-4">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <p className="font-bold text-white mb-1">Response Time</p>
              <p className="text-gray-400 text-sm">Within 24 hours<br />for all inquiries</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 text-center rounded-3xl bg-accent p-12">
            <h3 className="text-3xl font-black text-white mb-4">Ready to transform your store?</h3>
            <p className="text-red-200 mb-8">Be one of the first store owners running on RYXSOR AI.</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-accent font-black text-lg px-10 py-4 hover:bg-gray-100 transition-colors">
              Launch RYXSOR AI <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="text-red-200 text-sm mt-4">Free to start · No credit card · Works with Modisoft</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-black text-sm">R</div>
              <span className="text-gray-400 text-sm">RYXSOR AI — by RA</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <a href="#features" className="text-gray-500 hover:text-gray-300 text-xs">Features</a>
              <a href="#pricing" className="text-gray-500 hover:text-gray-300 text-xs">Pricing</a>
              <a href="#about" className="text-gray-500 hover:text-gray-300 text-xs">About</a>
              <a href="#contact" className="text-gray-500 hover:text-gray-300 text-xs">Contact</a>
              <Link href="/login" className="text-gray-500 hover:text-gray-300 text-xs">Sign In</Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-300 text-xs">Terms</Link>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-xs">Privacy</Link>
            </div>
            <p className="text-gray-600 text-xs">© 2026 RYXSOR AI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
