'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Package, Brain, FileText, TrendingUp, Shield, Zap } from 'lucide-react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if logged in - redirect to home
    try {
      const { createClient } = require('@/lib/supabase/client');
      createClient().auth.getSession().then(({ data }: any) => {
        if (data?.session) window.location.href = '/home';
      });
    } catch {}
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-black text-xl">R</div>
          <div>
            <p className="font-black text-gray-900 text-lg leading-none">RA Solution</p>
            <p className="text-xs text-gray-400">Gas Station Management</p>
          </div>
        </div>
        <Link href="/login" className="btn btn-ghost text-sm px-5 py-2.5">Sign In</Link>
      </div>

      <div className="px-6 pt-16 pb-12 text-center max-w-lg mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-1.5 mb-6">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold text-accent">AI-Powered Management</span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 leading-tight mb-4">
          Run your gas station<br />smarter, not harder
        </h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Upload your Modisoft report. AI reads everything — sales, inventory, ordering, profit — automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/home" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent text-white font-bold text-base px-8 py-4 hover:bg-red-700 transition-colors">
            Launch RA Solution <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 text-gray-700 font-bold text-base px-8 py-4 hover:bg-gray-50 transition-colors">
            Sign In
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">Free to start · No credit card · Works with Modisoft</p>
      </div>

      <div className="px-6 pb-16 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: BarChart3, label: 'Daily Reports',    desc: 'Upload Modisoft → instant P&L',    color: '#C0392B', bg: '#FEF2F2' },
            { icon: Package,   label: 'Inventory',        desc: 'Track every product automatically', color: '#2563EB', bg: '#EFF6FF' },
            { icon: Brain,     label: 'AI Ordering',      desc: '90-day velocity analysis',          color: '#7C3AED', bg: '#F5F3FF' },
            { icon: FileText,  label: 'Invoice Scanner',  desc: 'AI reads vendor invoices',          color: '#DB2777', bg: '#FDF2F8' },
            { icon: TrendingUp,label: 'Profit & Loss',    desc: '30-day trends and insights',        color: '#059669', bg: '#ECFDF5' },
            { icon: Shield,    label: 'Secure & Fast',    desc: 'Your data always safe',             color: '#D97706', bg: '#FFFBEB' },
          ].map(f => (
            <div key={f.label} className="rounded-2xl border border-gray-100 p-4 bg-white shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3" style={{ background: f.bg }}>
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <p className="font-bold text-gray-900 text-sm">{f.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-8 text-center">
        <p className="text-gray-500 text-sm mb-4">Already have an account?</p>
        <Link href="/login" className="inline-flex items-center gap-2 text-accent font-bold hover:underline">
          Sign in to your store <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
