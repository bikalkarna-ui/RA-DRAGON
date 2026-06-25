import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...i: ClassValue[]) { return twMerge(clsx(i)); }

export const fmt = {
  currency: (v: number | string | null | undefined) => {
    const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  },
  number: (v: number | string | null | undefined, d = 0) => {
    const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  },
  percent: (v: number, d = 1) => `${v.toFixed(d)}%`,
  date: (v: string | Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(v)),
  datetime: (v: string | Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(v)),
};

// Pre-built vendor/rep companies
export const VENDOR_COMPANIES = [
  { id: 'pepsi',     name: 'Pepsi',      color: '#004B93', emoji: '🔵', categories: ['Beverages', 'Energy Drinks'] },
  { id: 'coke',      name: 'Coca-Cola',  color: '#CC0001', emoji: '🔴', categories: ['Beverages', 'Juices'] },
  { id: 'fritolay',  name: 'Frito-Lay',  color: '#FFD700', emoji: '🟡', categories: ['Snacks', 'Chips'] },
  { id: 'rnk',       name: 'RNK',        color: '#7B2D8B', emoji: '🟣', categories: ['Tobacco', 'Cigarettes'] },
  { id: 'gg',        name: 'GG',         color: '#FF6600', emoji: '🟠', categories: ['Vape', 'Tobacco'] },
  { id: 'mclane',    name: 'McLane',     color: '#1B5E20', emoji: '🟢', categories: ['General', 'Grocery', 'Candy'] },
  { id: 'coremark',  name: 'Core-Mark',  color: '#E65100', emoji: '🔶', categories: ['General', 'Tobacco', 'Candy'] },
  { id: 'custom',    name: 'Other',      color: '#607D8B', emoji: '⚪', categories: [] },
];

export const getVendor = (id: string) => VENDOR_COMPANIES.find(v => v.id === id) ?? VENDOR_COMPANIES[VENDOR_COMPANIES.length - 1];
