'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { cn, VENDORS } from '@/lib/utils';
import { Upload, Check, X, ArrowRight, Brain, Database, RefreshCw, FileText } from 'lucide-react';

const FIELDS = ['product_name', 'sku', 'barcode', 'vendor_company', 'unit_cost', 'unit_price', 'quantity', 'min_quantity', '(skip)'];
const AUTO: Record<string, string> = { 'item name': 'product_name', 'product name': 'product_name', name: 'product_name', description: 'product_name', sku: 'sku', 'item code': 'sku', barcode: 'barcode', upc: 'barcode', vendor: 'vendor_company', company: 'vendor_company', cost: 'unit_cost', 'unit cost': 'unit_cost', 'cost price': 'unit_cost', price: 'unit_price', 'sell price': 'unit_price', 'retail price': 'unit_price', qty: 'quantity', quantity: 'quantity', 'qty on hand': 'quantity', stock: 'quantity', 'on hand': 'quantity' };

const parseCSV = (text: string): string[][] => text.split('\n').filter(l => l.trim()).map(line => { const r: string[] = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { if (line[i] === '"') { q = !q; continue; } if (line[i] === ',' && !q) { r.push(cur.trim()); cur = ''; continue; } cur += line[i]; } r.push(cur.trim()); return r; });

export default function MigrationPage() {
  const { store } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{ source: string; target: string }[]>([]);
  const [validRows, setValidRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('imports').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(5);
    setLogs(data ?? []);
  }, [store]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; setFile(f);
    const text = await f.text(); const rows = parseCSV(text);
    if (rows.length < 2) { alert('File appears empty.'); return; }
    const hdrs = rows[0]; setHeaders(hdrs); setRawRows(rows.slice(1).filter(r => r.some(c => c.trim())));
    setMapping(hdrs.map(h => ({ source: h, target: AUTO[h.toLowerCase().trim()] ?? '(skip)' })));
    setStep(1);
  };

  const validate = () => {
    const errs: string[] = [], valid: any[] = [];
    const ci = (t: string) => mapping.findIndex(m => m.target === t);
    const get = (row: string[], t: string) => { const i = ci(t); return i >= 0 ? row[i]?.trim() : undefined; };
    rawRows.forEach((row, i) => {
      const name = get(row, 'product_name'); if (!name) { errs.push(`Row ${i + 2}: missing name`); return; }
      const vc = get(row, 'vendor_company'); const mv = vc ? VENDORS.find(v => v.toLowerCase().includes(vc.toLowerCase()) || vc.toLowerCase().includes(v.toLowerCase())) : null;
      valid.push({ name, sku: get(row, 'sku') || null, barcode: get(row, 'barcode') || null, vendor_company: mv ?? vc ?? null, unit_cost: parseFloat(get(row, 'unit_cost') ?? '0') || 0, unit_price: parseFloat(get(row, 'unit_price') ?? '0') || 0, quantity: parseInt(get(row, 'quantity') ?? '0', 10) || 0, min_quantity: parseInt(get(row, 'min_quantity') ?? '5', 10) || 5, max_quantity: 100, taxable: true });
    });
    setValidRows(valid); setErrors(errs); setStep(3);
  };

  const doImport = async () => {
    if (!store) return; setImporting(true);
    const sb = createClient();
    const { data: log } = await sb.from('imports').insert({ store_id: store.id, type: 'products', status: 'running', file_name: file?.name, total_rows: validRows.length }).select('id').single();
    let imported = 0, failed = 0;
    for (const row of validRows) { try { await sb.from('products').upsert({ store_id: store.id, ...row }, { onConflict: 'store_id,sku', ignoreDuplicates: false }); imported++; } catch { failed++; } }
    if (log) await sb.from('imports').update({ status: 'completed', imported_rows: imported, failed_rows: failed, completed_at: new Date().toISOString() }).eq('id', log.id);
    setImportResult({ imported, failed }); setImporting(false); setStep(5); fetchLogs();
  };

  const reset = () => { setStep(0); setFile(null); setRawRows([]); setHeaders([]); setMapping([]); setValidRows([]); setErrors([]); setImportResult(null); if (fileRef.current) fileRef.current.value = ''; };

  const STEPS = ['Upload', 'Preview', 'Map', 'Validate', 'Import', 'Done'];

  return (
    <Screen title="Import Data" subtitle="CSV or Excel from any POS system — AI maps columns automatically">
      <div className="space-y-5">
        {/* Step pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className={cn('flex-none flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold', i === step ? 'bg-accent text-white' : i < step ? 'bg-accent/20 text-accent' : 'bg-card text-muted')}>
              {i < step ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}{s}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFile} />
            <div onClick={() => fileRef.current?.click()} className="drop-zone">
              <Upload className="h-12 w-12 text-dim" />
              <p className="text-text font-semibold text-lg">Upload your product file</p>
              <p className="text-muted text-sm">CSV or Excel export from Modisoft or any system</p>
              <span className="chip-gray">CSV · XLSX · XLS · TXT</span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="tile p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-400" />
              <div className="flex-1"><p className="font-semibold text-text text-sm">{file?.name}</p><p className="text-xs text-muted">{rawRows.length} rows found</p></div>
              <button onClick={reset} className="text-xs text-muted hover:text-sub">Change</button>
            </div>
            <button onClick={() => setStep(2)} className="btn btn-accent btn-full">Map Columns <ArrowRight className="h-4 w-4" /></button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="tile p-5">
              <div className="flex items-center gap-2 mb-4"><Brain className="h-5 w-5 text-violet-400" /><p className="font-semibold text-text">AI Column Mapping</p></div>
              <div className="space-y-2">
                {mapping.map((m, i) => (
                  <div key={m.source} className="flex items-center gap-3">
                    <p className="text-xs text-sub bg-card rounded-lg px-3 py-2 flex-1">{m.source}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-dim shrink-0" />
                    <select value={m.target} onChange={e => setMapping(p => p.map((x, j) => j === i ? { ...x, target: e.target.value } : x))} className={cn('inp flex-1 h-9 text-xs', m.target !== '(skip)' ? 'border-accent/40 text-accent' : '')}>{FIELDS.map(f => <option key={f} value={f}>{f}</option>)}</select>
                    {m.target !== '(skip)' && <Check className="h-4 w-4 text-accent shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={validate} className="btn btn-accent btn-full">Validate <ArrowRight className="h-4 w-4" /></button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="tile p-4 text-center"><p className="num text-2xl font-bold text-green-400">{validRows.length}</p><p className="text-xs text-muted mt-1">Valid</p></div>
              <div className="tile p-4 text-center"><p className="num text-2xl font-bold text-accent">{errors.length}</p><p className="text-xs text-muted mt-1">Errors</p></div>
              <div className="tile p-4 text-center"><p className="num text-2xl font-bold text-text">{rawRows.length}</p><p className="text-xs text-muted mt-1">Total</p></div>
            </div>
            <button onClick={() => setStep(4)} disabled={validRows.length === 0} className="btn btn-accent btn-full">Import {validRows.length} products <ArrowRight className="h-4 w-4" /></button>
          </div>
        )}

        {step === 4 && (
          <div className="tile p-10 text-center">
            <Database className="mx-auto h-12 w-12 text-accent mb-4" />
            <p className="font-bold text-text text-lg mb-2">Ready to import {validRows.length} products</p>
            <p className="text-muted text-sm mb-6">Existing products with matching SKUs will be updated. New ones created.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={doImport} disabled={importing} className="btn btn-accent px-8 py-3.5">
                {importing ? <><RefreshCw className="h-4 w-4 animate-spin" />Importing…</> : <>Start Import</>}
              </button>
              <button onClick={() => setStep(3)} disabled={importing} className="btn btn-ghost">Back</button>
            </div>
          </div>
        )}

        {step === 5 && importResult && (
          <div className="tile p-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15"><Check className="h-8 w-8 text-green-400" /></div>
            <p className="font-bold text-text text-xl mb-4">Import complete!</p>
            <div className="flex justify-center gap-10 mb-6">
              <div><p className="num text-3xl font-bold text-green-400">{importResult.imported}</p><p className="text-muted text-sm">Imported</p></div>
              <div><p className="num text-3xl font-bold text-accent">{importResult.failed}</p><p className="text-muted text-sm">Failed</p></div>
            </div>
            <div className="flex gap-3 justify-center">
              <a href="/inventory" className="btn btn-accent px-6">View Inventory</a>
              <button onClick={reset} className="btn btn-ghost">Import More</button>
            </div>
          </div>
        )}

        {logs.length > 0 && step === 0 && (
          <div>
            <p className="section-title">Import History</p>
            <div className="tile overflow-hidden divide-y divide-border/60">
              {logs.map(log => (
                <div key={log.id} className="list-row text-sm">
                  <div><p className="font-medium text-text">{log.file_name ?? 'Import'}</p><p className="text-xs text-muted">{new Date(log.created_at).toLocaleString()}</p></div>
                  <div className="flex items-center gap-2"><span className="text-muted text-xs num">{log.imported_rows}/{log.total_rows}</span><span className={cn('chip', log.status === 'completed' ? 'chip-green' : 'chip-gray')}>{log.status}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
