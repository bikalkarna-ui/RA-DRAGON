'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Search, Package, FileText, Users, BarChart3, X } from 'lucide-react';

type ResultType = 'product' | 'invoice' | 'employee' | 'report';

interface Result { type: ResultType; id: string; title: string; subtitle: string; value?: string; href: string; }

export default function SearchPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const search = useCallback(async (q: string) => {
    if (!store || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const sb = createClient();
      const [{ data: prods }, { data: invs }, { data: emps }, { data: rpts }] = await Promise.all([
        sb.from('products').select('id,name,vendor_company,department,quantity,unit_price,unit_cost,barcode,sku').eq('store_id', store.id).eq('is_active', true).or(`name.ilike.%${q}%,barcode.ilike.%${q}%,sku.ilike.%${q}%,vendor_company.ilike.%${q}%,department.ilike.%${q}%`).limit(10),
        sb.from('invoices').select('id,vendor_name,invoice_number,total_amount,status,created_at').eq('store_id', store.id).or(`vendor_name.ilike.%${q}%,invoice_number.ilike.%${q}%`).limit(10),
        sb.from('employees').select('id,name,role,phone').eq('store_id', store.id).eq('is_active', true).ilike('name', `%${q}%`).limit(5),
        sb.from('daily_reports').select('id,report_date,gross_sales,status').eq('store_id', store.id).limit(5),
      ]);

      const res: Result[] = [];

      (prods ?? []).forEach(p => res.push({ type: 'product', id: p.id, title: p.name, subtitle: `${p.vendor_company ?? '—'} · ${p.department ?? '—'} · Stock: ${p.quantity}`, value: fmt.currency(p.unit_price), href: '/inventory' }));
      (invs ?? []).forEach(i => res.push({ type: 'invoice', id: i.id, title: i.vendor_name ?? 'Unknown vendor', subtitle: `Invoice ${i.invoice_number ?? '—'} · ${i.status} · ${(() => { try { return new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } })()}`, value: fmt.currency(i.total_amount), href: '/invoices' }));
      (emps ?? []).forEach(e => res.push({ type: 'employee', id: e.id, title: e.name, subtitle: `${e.role}${e.phone ? ' · ' + e.phone : ''}`, href: '/employees' }));
      (rpts ?? []).filter(r => r.report_date.includes(q) || (Number(r.gross_sales) > 0 && q.includes('$'))).forEach(r => res.push({ type: 'report', id: r.id, title: `Daily Report ${r.report_date}`, subtitle: `Gross Sales: ${fmt.currency(r.gross_sales)} · ${r.status}`, value: fmt.currency(r.gross_sales), href: '/pos' }));

      setResults(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [store]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!mounted) return null;

  const ICON: Record<ResultType, any> = { product: Package, invoice: FileText, employee: Users, report: BarChart3 };
  const COLOR: Record<ResultType, string> = { product: 'bg-blue-50 text-blue-600', invoice: 'bg-pink-50 text-pink-600', employee: 'bg-cyan-50 text-cyan-600', report: 'bg-red-50 text-accent' };

  return (
    <Screen title="Search" subtitle="Find anything in your store">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Products, invoices, employees, dates…" className="inp pl-12 pr-12 py-4 text-base" />
          {query && <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text"><X className="h-4 w-4" /></button>}
        </div>

        {!query && (
          <div className="tile p-8 text-center">
            <Search className="h-12 w-12 text-dim mx-auto mb-3" />
            <p className="font-bold text-text mb-1">Search everything</p>
            <p className="text-muted text-sm">Products · Barcodes · Vendors · Invoices · Employees · Dates</p>
          </div>
        )}

        {loading && <div className="tile p-6 text-center"><p className="text-muted text-sm">Searching…</p></div>}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="tile p-8 text-center">
            <p className="font-bold text-text mb-1">No results for "{query}"</p>
            <p className="text-muted text-sm">Try a different search term</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="tile overflow-hidden divide-y divide-border/50">
            {results.map(r => {
              const Icon = ICON[r.type];
              return (
                <a key={r.id} href={r.href} className="flex items-center gap-4 px-5 py-4 hover:bg-surface transition-colors">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', COLOR[r.type])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text text-sm truncate">{r.title}</p>
                    <p className="text-xs text-muted truncate mt-0.5">{r.subtitle}</p>
                  </div>
                  {r.value && <p className="num font-bold text-text text-sm shrink-0">{r.value}</p>}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
