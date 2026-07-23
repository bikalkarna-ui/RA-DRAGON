'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, BarChart3, Bell, Menu, Plus, X, FileText, Upload, DollarSign,
  AlertTriangle, Truck, ClipboardList, Package, Fuel, Brain, PiggyBank,
  Sparkles, Users, BellPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  null, // center + button slot
  { href: '/alerts', icon: Bell, label: 'Alerts' },
  { href: '/settings', icon: Menu, label: 'More' },
];

const ACTIONS = [
  { href: '/invoices', icon: FileText, label: 'Scan Invoice', color: 'text-blue-400 bg-blue-500/10' },
  { href: '/pos', icon: Upload, label: 'Upload Daily Report', color: 'text-dark-red bg-dark-red/10' },
  { href: '/cashier?screen=drop', icon: DollarSign, label: 'Cash Drop', color: 'text-green-400 bg-green-500/10' },
  { href: '/cashier?screen=paidout', icon: AlertTriangle, label: 'Paid Out', color: 'text-red-400 bg-red-500/10' },
  { href: '/cashier?screen=vendor', icon: Truck, label: 'Vendor Payment', color: 'text-orange-400 bg-orange-500/10' },
  { href: '/pos', icon: ClipboardList, label: 'Drawer Count', color: 'text-amber-400 bg-amber-500/10' },
  { href: '/inventory', icon: Package, label: 'Inventory Count', color: 'text-cyan-400 bg-cyan-500/10' },
  { href: '/fuel', icon: Fuel, label: 'Fuel Delivery', color: 'text-purple-400 bg-purple-500/10' },
  { href: '/ordering', icon: Brain, label: 'Create Order', color: 'text-violet-400 bg-violet-500/10' },
  { href: '/deposit', icon: PiggyBank, label: 'Quick Deposit', color: 'text-emerald-400 bg-emerald-500/10' },
  { href: '/reports', icon: Sparkles, label: 'Generate AI Report', color: 'text-pink-400 bg-pink-500/10' },
  { href: '/employees', icon: Users, label: 'Add Employee', color: 'text-indigo-400 bg-indigo-500/10' },
  { href: '/alerts', icon: BellPlus, label: 'Create Alert', color: 'text-yellow-400 bg-yellow-500/10' },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {/* Action sheet */}
      {open && (
        <div className="fixed inset-0 z-[95] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-up" style={{ animationDuration: '0.2s' }} onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-dark-sidebar rounded-t-[28px] border-t border-dark-border shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-dark-border" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <p className="text-lg font-black text-white">Quick Actions</p>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-dark-sub">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 px-5 pb-8">
              {ACTIONS.map(action => (
                <button key={action.label} onClick={() => go(action.href)}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-dark-card border border-dark-border p-4 active:scale-95 transition-transform">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', action.color)}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-300 text-center leading-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[80] md:hidden bg-dark-sidebar/95 backdrop-blur-lg border-t border-dark-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map((item, i) => {
            if (item === null) {
              return (
                <button key="fab" onClick={() => setOpen(true)}
                  className="flex h-14 w-14 -mt-6 items-center justify-center rounded-full bg-dark-red shadow-lg shadow-dark-red/40 active:scale-95 transition-transform">
                  <Plus className="h-7 w-7 text-white" />
                </button>
              );
            }
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors',
                  active ? 'text-dark-red' : 'text-dark-sub')}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
