'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, BarChart3, Package, Brain, FileText, TrendingUp, Bell, Users } from 'lucide-react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    createClient().auth.getSession().then(({ data }: any) => {
      if (data?.session) window.location.href = '/home';
    });
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white font-black text-lg">R</div>
          <span className="font-black text-gray-900 text-lg">RA Solution</span>
        </div>
        <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900">Sign In</Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-md">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-white font-black text-4xl mb-8 shadow-lg">R</div>
          <h1 className="text-4xl font-black text-gray-900 leading-tight mb-4">
            AI-powered store management for gas stations
          </h1>
          <p className="text-gray-500 text-base mb-8 leading-relaxed">
            Upload your Modisoft daily report. AI reads everything — sales, inventory, ordering, profit &amp; loss — in seconds.
          </p>

          <div className="flex flex-col gap-3 mb-8">
            <Link href="/register"
              className="flex items-center justify-center gap-2 rounded-2xl bg-accent text-white font-bold text-lg px-8 py-4 hover:bg-red-700 active:scale-95 transition-all shadow-red">
              Launch RA Solution <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/login"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-base px-8 py-3.5 hover:border-gray-300 hover:bg-gray-50 transition-all">
              Sign in to existing account
            </Link>
          </div>

          <p className="text-xs text-gray-400">Free to use · Works with Modisoft · No credit card needed</p>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-16">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          {[
            { icon: BarChart3, label: 'Daily Reports',   desc: 'Modisoft → instant P&L',          color: '#C0392B', bg: '#FEF2F2' },
            { icon: Package,   label: 'Inventory',       desc: 'Track every product',              color: '#2563EB', bg: '#EFF6FF' },
            { icon: Brain,     label: 'AI Ordering',     desc: 'Smart reorder suggestions',        color: '#7C3AED', bg: '#F5F3FF' },
            { icon: FileText,  label: 'Invoices',        desc: 'Scan vendor invoices',             color: '#DB2777', bg: '#FDF2F8' },
            { icon: TrendingUp,label: 'Profit & Loss',   desc: '30-day trends',                    color: '#059669', bg: '#ECFDF5' },
            { icon: Bell,      label: 'Smart Alerts',    desc: 'Stock & price notifications',      color: '#D97706', bg: '#FFFBEB' },
          ].map(f => (
            <div key={f.label} className="rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: f.bg }}>
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <p className="font-bold text-gray-900 text-sm">{f.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
