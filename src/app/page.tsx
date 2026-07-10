'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowRight, BarChart3, Package, Brain, FileText,
  TrendingUp, Bell, Users, Check, Mail, Phone,
  Shield, Zap, Clock, Star, Menu, X
} from 'lucide-react';
import { ReviewsSection } from '@/components/landing/reviews-section';
import { ChatWidget } from '@/components/landing/chat-widget';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      createClient().auth.getSession().then(({ data }: any) => {
        if (data?.session) window.location.href = '/home';
      });
    } catch {}
  }, []);

  if (!mounted) return null;

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

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-black text-xl">R</div>
            <div>
              <span className="font-black text-gray-900 text-xl">RYXSOR AI</span>
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
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-red-50 border border-red-100 px-4 py-2 mb-8">
          <Zap className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-bold text-accent tracking-wide uppercase">AI-Powered Gas Station Management</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-gray-900 leading-tight mb-6">
          Run your store smarter.<br />
          <span className="text-accent">Not harder.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          RYXSOR AI sits on top of your existing Modisoft POS. Upload your daily report and AI automatically handles your P&amp;L, inventory, ordering, and invoices — so you can focus on your customers.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent text-white font-bold text-lg px-10 py-5 hover:bg-red-700 active:scale-95 transition-all shadow-lg">
            Launch RYXSOR AI <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-base px-8 py-4 hover:border-gray-300 hover:bg-gray-50 transition-all">
            Sign in to your store
          </Link>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />Free to start</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />Works with Modisoft</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-500" />No credit card needed</span>
        </div>
      </section>


      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 mb-4">Everything your store needs</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">Built specifically for gas stations and convenience stores. Every feature is designed around how your business actually works.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(f => (
            <div key={f.title} className="rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
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
          <h2 className="text-4xl font-black text-gray-900 mb-4">What makes RYXSOR AI different</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">We're not another generic inventory app. Here's what actually sets us apart.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { title: 'Works with your POS, not against it', desc: "Most tools ask you to switch systems entirely. RYXSOR AI sits on top of Modisoft — you keep what you already use and know." },
            { title: 'AI reads your paperwork, not the other way around', desc: 'Photograph an invoice or upload your daily report — the AI extracts every number. No manual data entry, no learning a new interface.' },
            { title: 'Built for gas stations specifically', desc: "Lottery book tracking, fuel margin analysis, vendor-based ordering — features generic retail software doesn't have, because it wasn't built for this industry." },
            { title: 'Founder who actually worked this job', desc: "Built by someone who grew up working in gas stations, not a generic SaaS template repurposed for a new market." },
          ].map(d => (
            <div key={d.title} className="rounded-2xl bg-gray-50 border border-gray-100 p-6">
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
            <h2 className="text-4xl font-black text-gray-900 mb-4">How it works</h2>
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

      {/* Reviews */}
      <ReviewsSection />

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-500">Start free. Upgrade when you're ready. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map(plan => (
              <div key={plan.name}
                className={`rounded-2xl border-2 p-8 relative ${plan.color} ${plan.dark ? 'text-white' : ''}`}>
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
            <h2 className="text-4xl font-black text-gray-900 mb-4">Built by people who understand your business</h2>
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
            <h2 className="text-4xl font-black text-white mb-4">Get in touch</h2>
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
            <div className="flex items-center gap-6">
              <a href="#features" className="text-gray-500 hover:text-gray-300 text-xs">Features</a>
              <a href="#pricing" className="text-gray-500 hover:text-gray-300 text-xs">Pricing</a>
              <a href="#about" className="text-gray-500 hover:text-gray-300 text-xs">About</a>
              <a href="#contact" className="text-gray-500 hover:text-gray-300 text-xs">Contact</a>
              <Link href="/login" className="text-gray-500 hover:text-gray-300 text-xs">Sign In</Link>
            </div>
            <p className="text-gray-600 text-xs">© 2026 RYXSOR AI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
