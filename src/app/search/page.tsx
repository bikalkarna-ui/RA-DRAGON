'use client';
import { useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Search, Package, FileText, ShoppingCart, TrendingUp } from 'lucide-react';

interface Result { type: 'product' | 'invoice' | 'sale'; id: string; title: string; subtitle: string; value?: string; }

export default function SearchPage() {
  const { store } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim() || q.length < 2 || !store) { setResults([]); return; }
    setLoading(true);
    const sb = createClient();
    const [{ data: prods }, { data: invs }, { data: sis }] = await Promise.all([
      sb.from('products').select('id,name,unit_price,unit_cost,quantity,vendor_company,barcode,sku').eq('store_id', store.id).eq('is_active', true).or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`).limit(10),
      sb.from('invoices').select('id,vendor_name,vendor_company,total_amount,created_at,invoice_number').eq('store_id', store.id).or(`vendor_name.ilike.%${q}%,vendor_company.ilike.%${q}%,invoice_number.ilike.%${q}%`).limit(5),
      sb.from('sale_items').select('id,product_name,line_total,created_at,quantity').eq('store_id', store.id).ilike('product_name', `%${q}%`).order('created_at', { ascending: false }).limit(8),
    ]);
    const r: Result[] = [
      ...(prods ?? []).map(p => ({ type: 'product' as const, id: p.id, title: p.name, subtitle: `${p.vendor_company ?? '—'} · ${p.quantity} in stock · ${p.barcode ?? p.sku ?? 'no barcode'}`, value: fmt.currency(p.unit_price) })),
      ...(invs ?? []).map(i => ({ type: 'invoice' as const, id: i.id, title: i.vendor_name ?? 'Invoice', subtitle: `${i.vendor_company ?? ''} · ${new Date(i.created_at).toLocaleDateString()}${i.invoice_number ? ` · #${i.invoice_number}` : ''}`, value: i.total_amount ? fmt.currency(i.total_amount) : undefined })),
      ...(sis ?? []).map(s => ({ type: 'sale' as const, id: s.id, title: s.product_name, subtitle: `${s.quantity} sold · ${new Date(s.created_at).toLocaleDateString()}`, value: fmt.currency(s.line_total) })),
    ];
    setResults(r); setLoading(false);
  }, [store]);

  const ICONS = { product: Package, invoice: FileText, sale: ShoppingCart };
  const COLORS = { product: 'bg-blue-500/10 text-blue-400', invoice: 'bg-pink-500/10 text-pink-400', sale: 'bg-green-500/10 text-green-400' };

  return (
    <Screen title="Search Everything" subtitle="Products, invoices, sales, reports">
      <div className="space-y-4">
        <div className="relative sticky top-4 z-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input value={query} onChange={e => doSearch(e.target.value)} autoFocus placeholder="Product name, barcode, vendor, invoice…" className="inp pl-12 h-13 text-base" />
        </div>

        {!query && (
          <div className="tile p-8 text-center">
            <Search className="mx-auto h-10 w-10 text-dim mb-3" />
            <p className="text-text font-semibold mb-1">Search everything</p>
            <p className="text-muted text-sm">Type a product name, barcode, vendor name, invoice number, or date.</p>
          </div>
        )}

        {loading && <p className="text-center text-muted py-6">Searching…</p>}

        {!loading && query && results.length === 0 && (
          <div className="tile p-8 text-center"><p className="text-muted">No results for "{query}"</p></div>
        )}

        {results.length > 0 && (
          <div className="tile overflow-hidden divide-y divide-border/60">
            {results.map(r => {
              const Icon = ICONS[r.type]; const col = COLORS[r.type];
              return (
                <div key={`${r.type}-${r.id}`} className="list-row">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', col)}><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{r.title}</p>
                      <p className="text-xs text-muted truncate">{r.subtitle}</p>
                    </div>
                  </div>
                  {r.value && <span className="num text-sm font-bold text-text shrink-0 ml-2">{r.value}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
