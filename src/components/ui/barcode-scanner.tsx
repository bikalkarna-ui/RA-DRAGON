'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, X, Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScanResult {
  barcode: string;
  product: any | null;
}

interface BarcodeScannerProps {
  storeId: string;
  onScan: (result: ScanResult) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  /** If true, shows as inline search bar instead of floating button */
  inline?: boolean;
}

export function BarcodeScanner({
  storeId, onScan, placeholder = 'Scan barcode or type SKU…',
  label, className, autoFocus = false, inline = false,
}: BarcodeScannerProps) {
  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<NodeJS.Timeout>();

  // Hardware scanner support — fast keystrokes ending with Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only intercept if not already focused in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter' && barcodeBuffer.current.length > 2) {
        handleScan(barcodeBuffer.current.trim());
        barcodeBuffer.current = '';
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 80);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [storeId]);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setScanning(true);
    setLastScan(code);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const { data } = await sb.from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .or(`barcode.eq.${code},sku.eq.${code}`)
        .maybeSingle();
      onScan({ barcode: code, product: data ?? null });
    } catch {
      onScan({ barcode: code, product: null });
    } finally {
      setScanning(false);
      setValue('');
    }
  }, [storeId, onScan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) handleScan(value.trim());
  };

  if (inline) {
    return (
      <form onSubmit={handleSubmit} className={cn('relative', className)}>
        {label && <label className="d-label">{label}</label>}
        <div className="relative">
          <Scan className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', scanning ? 'text-fire-500 animate-pulse' : 'text-obsidian-600')} />
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="d-input pl-9 pr-4 w-full"
          />
          {value && (
            <button type="button" onClick={() => setValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-600 hover:text-obsidian-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {lastScan && scanning && (
          <p className="mt-1 text-xs text-fire-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />Looking up {lastScan}…
          </p>
        )}
      </form>
    );
  }

  // Floating scanner button + expandable input
  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Scan className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4', scanning ? 'text-fire-500 animate-pulse' : 'text-obsidian-600')} />
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            className="d-input pl-9 w-full h-9"
          />
        </div>
        <button type="submit" disabled={scanning || !value.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-fire-900/50 border border-fire-800/50 px-3 py-2 text-xs font-medium text-fire-400 hover:bg-fire-900/80 disabled:opacity-40 transition-all whitespace-nowrap">
          <Scan className="h-3.5 w-3.5" />{scanning ? 'Looking up…' : 'Scan / Search'}
        </button>
      </form>
    </div>
  );
}

/** Floating scan result toast */
export function ScanToast({ product, barcode, onClose }: { product: any | null; barcode: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 d-card border-fire-900/60 shadow-fire animate-scale-appear p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 mb-2">
          <Scan className="h-4 w-4 text-fire-500 shrink-0" />
          <p className="text-xs text-obsidian-500 font-mono">{barcode}</p>
        </div>
        <button onClick={onClose} className="text-obsidian-600 hover:text-obsidian-300 shrink-0"><X className="h-3.5 w-3.5" /></button>
      </div>
      {product ? (
        <div>
          <p className="font-semibold text-white text-sm">{product.name}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-obsidian-500">Stock</p><p className={cn('font-bold mono', product.quantity === 0 ? 'text-fire-400' : product.quantity <= product.min_quantity ? 'text-gold-400' : 'text-white')}>{product.quantity}</p></div>
            <div><p className="text-obsidian-500">Cost</p><p className="font-bold mono text-white">${Number(product.unit_cost).toFixed(2)}</p></div>
            <div><p className="text-obsidian-500">Price</p><p className="font-bold mono text-fire-400">${Number(product.unit_price).toFixed(2)}</p></div>
          </div>
          {product.vendor_company && <p className="mt-1.5 text-xs text-obsidian-500">Vendor: {product.vendor_company}</p>}
        </div>
      ) : (
        <div>
          <p className="font-semibold text-fire-400 text-sm">Product not found</p>
          <p className="text-xs text-obsidian-500 mt-1">No product matched barcode <span className="mono">{barcode}</span></p>
        </div>
      )}
    </div>
  );
}
