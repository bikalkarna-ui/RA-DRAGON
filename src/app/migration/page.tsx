'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { cn, VENDOR_COMPANIES } from '@/lib/utils';
import { Upload, Check, X, FileText, ArrowRight, Brain, Database, RefreshCw } from 'lucide-react';

const STEPS = ['Upload','Preview','AI Mapping','Validate','Import','Done'];
const FIELDS = ['product_name','sku','barcode','vendor_company','unit_cost','unit_price','quantity','min_quantity','max_quantity','taxable','(skip)'];

const AUTO_MAP: Record<string,string> = {
  'item name':'product_name','product name':'product_name','name':'product_name','description':'product_name','item':'product_name',
  'sku':'sku','item code':'sku','code':'sku','product code':'sku',
  'barcode':'barcode','upc':'barcode','scan code':'barcode',
  'vendor':'vendor_company','company':'vendor_company','supplier':'vendor_company',
  'cost':'unit_cost','unit cost':'unit_cost','purchase price':'unit_cost','cost price':'unit_cost','buy price':'unit_cost',
  'price':'unit_price','sell price':'unit_price','retail price':'unit_price','selling price':'unit_price','unit price':'unit_price',
  'qty':'quantity','quantity':'quantity','qty on hand':'quantity','stock':'quantity','on hand':'quantity','count':'quantity','inventory':'quantity',
  'min qty':'min_quantity','minimum qty':'min_quantity','reorder point':'min_quantity','min stock':'min_quantity',
  'max qty':'max_quantity','maximum qty':'max_quantity','max stock':'max_quantity',
  'taxable':'taxable','tax':'taxable',
};

export default function MigrationPage() {
  const { store } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File|null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<{source:string;target:string}[]>([]);
  const [validRows, setValidRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{imported:number;failed:number}|null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('imports').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(10);
    setLogs(data ?? []);
  }, [store]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const result: string[] = []; let current = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i]==='"') { inQuotes=!inQuotes; continue; }
        if (line[i]===',' && !inQuotes) { result.push(current.trim()); current=''; continue; }
        current += line[i];
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f);
    const text = await f.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { alert('File appears empty.'); return; }
    const hdrs = rows[0];
    const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));
    setHeaders(hdrs); setRawRows(dataRows);
    setMapping(hdrs.map(h => ({ source:h, target:AUTO_MAP[h.toLowerCase().trim()] ?? '(skip)' })));
    setStep(1);
  };

  const validate = () => {
    const errs: string[] = []; const valid: any[] = [];
    const ci = (target: string) => mapping.findIndex(m => m.target === target);
    const get = (row: string[], target: string) => { const i = ci(target); return i>=0?row[i]?.trim():undefined; };
    rawRows.forEach((row, i) => {
      const name = get(row, 'product_name');
      if (!name) { errs.push(`Row ${i+2}: missing product name`); return; }
      const vc = get(row, 'vendor_company');
      const matchedVendor = vc ? VENDOR_COMPANIES.find(v => v.name.toLowerCase().includes(vc.toLowerCase()) || vc.toLowerCase().includes(v.name.toLowerCase())) : null;
      valid.push({
        name, sku:get(row,'sku')||null, barcode:get(row,'barcode')||null,
        vendor_company: matchedVendor?.name ?? vc ?? null,
        unit_cost:parseFloat(get(row,'unit_cost')??'0')||0, unit_price:parseFloat(get(row,'unit_price')??'0')||0,
        quantity:parseInt(get(row,'quantity')??'0',10)||0, min_quantity:parseInt(get(row,'min_quantity')??'5',10)||5,
        max_quantity:parseInt(get(row,'max_quantity')??'100',10)||100,
        taxable:!['no','false','0','n'].includes((get(row,'taxable')??'').toLowerCase()),
      });
    });
    setValidRows(valid); setErrors(errs); setStep(3);
  };

  const doImport = async () => {
    if (!store) return; setImporting(true);
    const sb = createClient();
    const { data: log } = await sb.from('imports').insert({ store_id:store.id, type:'products', status:'running', file_name:file?.name, total_rows:validRows.length }).select('id').single();
    let imported=0, failed=0;
    for (const row of validRows) {
      try {
        await sb.from('products').upsert({ store_id:store.id, ...row }, { onConflict:'store_id,sku', ignoreDuplicates:false });
        imported++;
      } catch { failed++; }
    }
    if (log) await sb.from('imports').update({ status:'completed', imported_rows:imported, failed_rows:failed, completed_at:new Date().toISOString() }).eq('id', log.id);
    setImportResult({ imported, failed }); setImporting(false); setStep(5); fetchLogs();
  };

  const reset = () => { setStep(0); setFile(null); setRawRows([]); setHeaders([]); setMapping([]); setValidRows([]); setErrors([]); setImportResult(null); if (fileRef.current) fileRef.current.value=''; };

  return (
    <AppShell title="Migration Center" storeName={store?.name}>
      <div className="space-y-5">
        <div className="d-card p-5">
          <div className="flex items-center gap-2 mb-2"><Database className="h-5 w-5 text-fire-500"/><h2 className="font-bold text-white">Import Products from CSV / Excel</h2></div>
          <p className="text-sm text-obsidian-400">Export your products from any system as CSV. RA Solution AI automatically maps the columns — even if named differently.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {STEPS.map((s,i) => (
            <div key={s} className="flex items-center">
              <div className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap', i===step?'bg-fire-700 text-white':i<step?'bg-fire-900/40 text-fire-400':'text-obsidian-600')}>
                {i<step?<Check className="h-3 w-3"/>:<span>{i+1}</span>}{s}
              </div>
              {i<STEPS.length-1&&<ArrowRight className="h-3 w-3 text-obsidian-700 mx-0.5 shrink-0"/>}
            </div>
          ))}
        </div>

        {/* Step 0 */}
        {step===0 && (
          <div className="d-card p-10 text-center">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleFile}/>
            <Upload className="mx-auto h-12 w-12 text-obsidian-700 mb-4"/>
            <h3 className="text-lg font-bold text-white mb-2">Upload your product file</h3>
            <p className="text-sm text-obsidian-500 mb-6">CSV or Excel — export from any system.</p>
            <button onClick={()=>fileRef.current?.click()} className="btn-fire px-6 py-3 text-base"><Upload className="h-4 w-4"/>Choose file</button>
          </div>
        )}

        {/* Step 1: Preview */}
        {step===1 && (
          <div className="space-y-4">
            <div className="d-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-obsidian-500"/><span className="text-sm font-medium text-white">{file?.name}</span><span className="d-badge bg-obsidian-800 text-obsidian-400">{rawRows.length} rows</span></div>
              <button onClick={reset} className="text-xs text-obsidian-500 hover:text-fire-400">Change file</button>
            </div>
            <div className="d-card overflow-hidden">
              <div className="border-b border-dragon-border px-4 py-3"><p className="font-semibold text-white text-sm">Preview (first 5 rows)</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-obsidian-900/50"><tr>{headers.map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-obsidian-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-dragon-border">
                    {rawRows.slice(0,5).map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className="px-3 py-2 text-obsidian-300 whitespace-nowrap max-w-xs truncate">{cell}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={()=>setStep(2)} className="btn-fire">Continue to AI Mapping <ArrowRight className="h-4 w-4"/></button>
          </div>
        )}

        {/* Step 2: AI Mapping */}
        {step===2 && (
          <div className="space-y-4">
            <div className="d-card p-5">
              <div className="flex items-center gap-2 mb-4"><Brain className="h-5 w-5 text-fire-500"/><h3 className="font-bold text-white">AI Column Mapping</h3></div>
              <p className="text-sm text-obsidian-400 mb-4">AI detected what each column contains. Adjust if needed.</p>
              <div className="space-y-2">
                {mapping.map((m,i) => (
                  <div key={m.source} className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg bg-obsidian-900 px-3 py-2 text-sm text-obsidian-300 border border-dragon-border">{m.source}</div>
                    <ArrowRight className="h-4 w-4 text-obsidian-600 shrink-0"/>
                    <select value={m.target} onChange={e=>setMapping(prev=>prev.map((x,j)=>j===i?{...x,target:e.target.value}:x))}
                      className={cn('flex-1 d-select', m.target!=='(skip)'?'border-fire-800/60 text-fire-400':'')}>
                      {FIELDS.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                    {m.target!=='(skip)'&&<Check className="h-4 w-4 text-fire-600 shrink-0"/>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={validate} className="btn-fire">Validate data <ArrowRight className="h-4 w-4"/></button>
              <button onClick={()=>setStep(1)} className="btn-ghost">Back</button>
            </div>
          </div>
        )}

        {/* Step 3: Validate */}
        {step===3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="d-card p-4 text-center"><p className="text-2xl font-bold text-white">{validRows.length}</p><p className="text-xs text-obsidian-500">Valid rows</p></div>
              <div className="d-card p-4 text-center"><p className="text-2xl font-bold text-fire-400">{errors.length}</p><p className="text-xs text-obsidian-500">Errors</p></div>
              <div className="d-card p-4 text-center"><p className="text-2xl font-bold text-obsidian-300">{rawRows.length}</p><p className="text-xs text-obsidian-500">Total rows</p></div>
            </div>
            {errors.length>0&&<div className="d-card p-4"><p className="font-semibold text-fire-400 mb-2">Errors (rows will be skipped)</p><ul className="text-xs text-obsidian-400 space-y-1 max-h-24 overflow-y-auto">{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
            <div className="flex gap-2">
              <button onClick={()=>setStep(4)} disabled={validRows.length===0} className="btn-fire">Proceed to import <ArrowRight className="h-4 w-4"/></button>
              <button onClick={()=>setStep(2)} className="btn-ghost">Back</button>
            </div>
          </div>
        )}

        {/* Step 4: Import */}
        {step===4 && (
          <div className="d-card p-10 text-center">
            <Database className="mx-auto h-12 w-12 text-fire-500 mb-4"/>
            <h3 className="text-xl font-bold text-white mb-2">Import {validRows.length} products</h3>
            <p className="text-sm text-obsidian-400 mb-6">Products with matching SKUs will be updated. New products will be created.</p>
            <div className="flex justify-center gap-3">
              <button onClick={doImport} disabled={importing} className="btn-fire px-6 py-3 text-base">
                {importing?<><RefreshCw className="h-4 w-4 animate-spin"/>Importing…</>:<><Check className="h-4 w-4"/>Start import</>}
              </button>
              <button onClick={()=>setStep(3)} disabled={importing} className="btn-ghost px-4 py-3">Back</button>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step===5&&importResult&&(
          <div className="d-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fire-900/30 border border-fire-800/30">
              <Check className="h-8 w-8 text-fire-500"/>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Import complete!</h3>
            <div className="flex justify-center gap-8 mb-6">
              <div><p className="text-3xl font-bold text-fire-400">{importResult.imported}</p><p className="text-sm text-obsidian-500">Imported</p></div>
              <div><p className="text-3xl font-bold text-obsidian-400">{importResult.failed}</p><p className="text-sm text-obsidian-500">Failed</p></div>
            </div>
            <div className="flex justify-center gap-3">
              <a href="/inventory" className="btn-fire px-6 py-3">View inventory <ArrowRight className="h-4 w-4"/></a>
              <button onClick={reset} className="btn-ghost px-4 py-3">Import another</button>
            </div>
          </div>
        )}

        {/* Log history */}
        {logs.length>0&&(
          <div className="d-card overflow-hidden">
            <div className="border-b border-dragon-border px-5 py-3.5"><h3 className="font-semibold text-white">Import History</h3></div>
            <div className="divide-y divide-dragon-border">
              {logs.map(log=>(
                <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div><p className="text-white font-medium">{log.file_name??'Import'}</p><p className="text-xs text-obsidian-500">{new Date(log.created_at).toLocaleString()}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-obsidian-500">{log.imported_rows}/{log.total_rows}</span>
                    <span className={cn('d-badge text-xs', log.status==='completed'?'bg-fire-900/30 text-fire-400':'bg-obsidian-700 text-obsidian-400')}>{log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
