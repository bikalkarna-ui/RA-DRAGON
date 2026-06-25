'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, FileText, BarChart3,
  Users, Settings, LogOut, Flame, Menu, X, Brain, Ticket, Fuel, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Live Sales / POS', href: '/pos', icon: ShoppingCart },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'AI Invoice Scanner', href: '/invoices', icon: FileText },
  { label: 'Smart Ordering', href: '/ordering', icon: Brain },
  { label: 'Sales Reports', href: '/reports', icon: BarChart3 },
  { label: 'Lottery & Fuel', href: '/lottery', icon: Ticket },
  { label: 'Employees', href: '/employees', icon: Users },
  { label: 'Migration Center', href: '/migration', icon: Upload },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ title, children, storeName }: { title: string; children: React.ReactNode; storeName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login'); router.refresh();
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-dragon-card border-r border-dragon-border">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-dragon-border">
        <Flame className="h-7 w-7 text-fire-500 shrink-0 animate-fire-pulse" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-none">RA Solution</p>
          <p className="text-[10px] text-obsidian-500 truncate mt-0.5">{storeName ?? '…'}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} onClick={() => setOpen(false)}
              className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-fire-900/60 text-fire-400 border-l-2 border-fire-600 pl-[10px] shadow-fire-sm'
                  : 'text-obsidian-400 hover:bg-obsidian-900/60 hover:text-obsidian-100')}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-dragon-border p-2">
        <button onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-obsidian-500 hover:bg-fire-950/50 hover:text-fire-400 transition-all">
          <LogOut className="h-4 w-4" />Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dragon-dark">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0"><SidebarContent /></aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-2xl"><SidebarContent /></div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-dragon-border bg-dragon-card px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden p-1.5 rounded-lg text-obsidian-500 hover:text-white hover:bg-obsidian-800">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-white text-base">{title}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex h-2 w-2 rounded-full bg-fire-500 animate-fire-pulse" />
            <span className="text-xs text-obsidian-500 hidden sm:block">Live</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}
