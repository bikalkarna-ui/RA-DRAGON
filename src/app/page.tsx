import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  ShoppingCart, Brain, Package, Bell, FileText, BarChart3,
  Search, Upload, Check, ArrowRight, Zap, Shield, Clock
} from 'lucide-react';

export default async function LandingPage() {
  // If already logged in, send straight to the app
  const { data: { user } } = await createClient().auth.getUser();
  if (user) redirect('/home');

  const FEATURES = [
    { icon: ShoppingCart, color: '#16A34A', bg: '#F0FDF4', label: 'Live Sales / POS', desc: 'Ring up customers, scan barcodes, print receipts. Inventory updates itself after every sale.' },
    { icon: Brain,        color: '#7C3AED', bg: '#F5F3FF', label: 'AI Smart Ordering', desc: 'Tap a vendor — AI checks your stock levels, sales velocity, and generates the perfect order.' },
    { icon: Package,      color: '#2563EB', bg: '#EFF6FF', label: 'Inventory Control', desc: 'Search, scan, track every product. Low stock and out-of-stock alerts so you never miss a sale.' },
    { icon: Bell,         color: '#D97706', bg: '#FFFBEB', label: 'Price Alerts',      desc: 'Every time a vendor raises prices, you get an instant alert. Accept or reject the change.' },
    { icon: FileText,     color: '#DB2777', bg: '#FDF2F8', label: 'Invoice Scanner',   desc: 'Upload any invoice PDF or photo. AI reads every line, matches products, updates your costs.' },
    { icon: BarChart3,    color: '#059669', bg: '#ECFDF5', label: 'Daily Reports',     desc: 'Net sales, gross profit, lottery, fuel — every day automatically saved in your archive forever.' },
    { icon: Search,       color: '#EA580C', bg: '#FFF7ED', label: 'Global Search',     desc: 'Find any product, invoice, sale, or report in seconds. One search box, everything.' },
    { icon: Upload,       color: '#6B7280', bg: '#F9FAFB', label: 'Import Any POS',    desc: 'Export CSV from Modisoft or any system. AI maps your columns and creates your entire inventory.' },
  ];

  const STATS = [
    { number: '2 min', label: 'to set up your store' },
    { number: '$0', label: 'manual data entry' },
    { number: '100%', label: 'automatic reporting' },
    { number: '24/7', label: 'works on any device' },
  ];

  const HOW = [
    { step: 'Import', desc: 'Upload your existing inventory CSV from any POS. AI maps every column.' },
    { step: 'Sell', desc: 'Scan products at the register. Inventory and reports update automatically.' },
    { step: 'Order', desc: 'Tap any vendor. AI generates your reorder list. Approve and send.' },
    { step: 'Review', desc: 'Check your daily report every evening. Everything is already calculated.' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white font-bold text-base shadow-red">R</div>
            <span className="font-bold text-gray-900 text-lg">RA Solution</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/register" className="btn-accent text-sm px-5 py-2.5 rounded-xl">Start free →</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-1.5 mb-8">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-sm font-semibold text-accent">AI-powered · No training needed · Works on any device</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6 max-w-4xl mx-auto">
          Run your store.<br />
          <span className="text-accent">Not your spreadsheets.</span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          RA Solution replaces Modisoft, paper logs, and Excel for gas stations and convenience stores.
          Upload an invoice. Scan a barcode. Get your daily report. That's it.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="btn-accent text-base px-8 py-4 rounded-2xl shadow-red w-full sm:w-auto">
            Start for free — no credit card
          </Link>
          <Link href="/login" className="btn-ghost text-base px-8 py-4 rounded-2xl w-full sm:w-auto">
            Sign in to my store
          </Link>
        </div>

        {/* Live store preview — the signature element */}
        <div className="mt-16 mx-auto max-w-2xl">
          <div className="rounded-2xl border border-gray-200 shadow-lifted overflow-hidden bg-white">
            {/* Mock app header */}
            <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium">Good morning</p>
                <p className="font-bold text-gray-900">Quick Stop #1</p>
              </div>
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-green-700">Live</span>
              </div>
            </div>
            {/* Today strip */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Today's Sales</p>
                <p className="font-mono font-bold text-3xl text-gray-900">$4,217.50</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Profit</p>
                <p className="font-mono font-bold text-xl text-green-600">$891.20</p>
              </div>
            </div>
            {/* App grid preview */}
            <div className="p-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Live Sales',  color: '#16A34A', bg: '#F0FDF4', icon: '🛒' },
                { label: 'AI Order',    color: '#7C3AED', bg: '#F5F3FF', icon: '🤖' },
                { label: 'Inventory',   color: '#2563EB', bg: '#EFF6FF', icon: '📦' },
                { label: 'Reports',     color: '#059669', bg: '#ECFDF5', icon: '📊' },
              ].map(app => (
                <div key={app.label} className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ background: app.bg }}>
                  <span className="text-2xl">{app.icon}</span>
                  <p className="text-[10px] font-semibold text-center leading-tight" style={{ color: app.color }}>{app.label}</p>
                </div>
              ))}
            </div>
            {/* Recent sale */}
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Red Bull 2-pack · Cash</span>
              </div>
              <span className="font-mono text-sm font-bold text-gray-900">$7.98</span>
            </div>
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Marlboro Red · Credit</span>
              </div>
              <span className="font-mono text-sm font-bold text-gray-900">$12.49</span>
            </div>
            <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Pepsi 20oz · Mobile Pay</span>
              </div>
              <span className="font-mono text-sm font-bold text-gray-900">$2.29</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400 text-center">This is what your store dashboard looks like</p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-accent py-14">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="font-black text-4xl text-white font-mono mb-2">{s.number}</p>
              <p className="text-sm text-red-200 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-accent text-center mb-3">How it works</p>
        <h2 className="text-4xl font-black text-gray-900 text-center mb-14">Four steps, zero headaches</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {HOW.map((h, i) => (
            <div key={h.step} className="flex items-start gap-4 bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white font-black text-base shadow-red">{i + 1}</div>
              <div>
                <p className="font-bold text-gray-900 text-lg mb-1">{h.step}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-accent text-center mb-3">Everything included</p>
          <h2 className="text-4xl font-black text-gray-900 text-center mb-14">Every tool your store needs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(feat => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card hover:shadow-lifted transition-shadow">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: feat.bg }}>
                    <Icon className="h-6 w-6" style={{ color: feat.color }} />
                  </div>
                  <p className="font-bold text-gray-900 mb-2">{feat.label}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MODISOFT REPLACE ── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gray-900 p-10 sm:p-14 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-4">Switching from Modisoft?</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-5">Export your inventory CSV.<br />We import it in 2 minutes.</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto text-base leading-relaxed">No expensive database purchase. No rep visits. Just export your products from Modisoft, upload the file, and AI maps every column automatically. Your entire store is set up instantly.</p>
          <Link href="/register" className="btn-accent text-base px-8 py-4 rounded-2xl shadow-red inline-flex items-center gap-2">
            Import my inventory now <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-accent py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">Your store deserves better than Excel.</h2>
          <p className="text-red-200 text-lg mb-10">Start free. No credit card. Works on your phone, tablet, or computer.</p>
          <Link href="/register" className="inline-flex items-center gap-3 bg-white text-accent font-bold text-lg px-10 py-5 rounded-2xl hover:bg-gray-50 transition-colors shadow-lg">
            Create your free account <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-5 text-red-200 text-sm">Setup in 2 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white font-bold text-xs">R</div>
            <span className="font-semibold text-gray-600">RA Solution</span>
          </div>
          <p>AI-powered management for gas stations & convenience stores</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-gray-700 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-700 transition-colors">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
