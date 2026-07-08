'use client';
/**
 * MultiScan — camera-first, multi-image scanner used across all pages.
 * Flow: user taps camera OR selects files → previews ALL pages → hits Submit → AI runs → onResult called
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Send, Loader2, CheckCircle, AlertCircle, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface MultiScanProps {
  endpoint: string;
  onResult: (data: any) => void;
  title?: string;
  hint?: string;
  extraFields?: Record<string, string>;
  className?: string;
}

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|LinkedInApp/i.test(ua);
}

// Convert any captured/selected image (including iPhone HEIC) into a standard
// JPEG File before upload. Fixes a WebKit bug where FormData uploads of
// non-standard image types throw "The string did not match the expected
// pattern", and ensures the AI vision API (which rejects HEIC) always gets a
// format it accepts. PDFs pass through untouched.
async function normalizeImage(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX_DIM = 1800;
    let { width, height } = bitmap;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    const newName = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    // If conversion fails for any reason, fall back to the original file
    // rather than blocking the upload entirely.
    return file;
  }
}

export function MultiScan({ endpoint, onResult, title = 'Scan or Upload', hint, extraFields, className }: MultiScanProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const [state, setState] = useState<'idle' | 'preview' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [debugStage, setDebugStage] = useState('');

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('ra_active_store_id') : null;
      if (saved) { setStoreId(saved); return; }
      createClient().from('stores').select('id').limit(1).maybeSingle()
        .then(({ data }) => { if (data) setStoreId(data.id); });
    } catch { /* ignore */ }
  }, []);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setProgress('Processing photo…');
    const normalized = await Promise.all(Array.from(files).map(normalizeImage));
    const newImgs = normalized.map(file => ({ url: URL.createObjectURL(file), file }));
    setImages(prev => [...prev, ...newImgs]);
    setState('preview');
    setProgress('');
  }, []);

  const remove = (i: number) => {
    URL.revokeObjectURL(images[i].url);
    const next = images.filter((_, j) => j !== i);
    setImages(next);
    if (next.length === 0) setState('idle');
  };

  const submit = async () => {
    if (images.length === 0) return;
    setState('loading');
    setProgress(`Sending ${images.length} page${images.length > 1 ? 's' : ''} to AI…`);

    let stage = 'building upload';
    try {
      const fd = new FormData();
      images.forEach((img, i) => fd.append(i === 0 ? 'file' : `file${i}`, img.file));
      if (extraFields) Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
      // Always send store_id so API can find the right store
      if (storeId) fd.append('store_id', storeId);

      setProgress('AI reading report…');
      stage = 'sending to server';
      const res = await fetch(endpoint, { method: 'POST', body: fd });

      stage = 'reading server response';
      const data = await res.json();

      if (!res.ok) {
        // Make error message user-friendly
        let errMsg = data.error || 'Upload failed';
        if (errMsg.includes('string') && errMsg.includes('pattern')) {
          errMsg = 'Date format error — please try again';
        } else if (errMsg.includes('not authenticated')) {
          errMsg = 'Please log in again';
        }
        throw new Error(errMsg);
      }

      setState('done');
      setMsg(`${images.length} page${images.length > 1 ? 's' : ''} processed`);
      onResult(data);

      // Cleanup
      images.forEach(img => URL.revokeObjectURL(img.url));
      setImages([]);
    } catch (err: any) {
      setState('error');
      console.error(`MultiScan failed at stage "${stage}":`, err);
      const technical = `[${stage}] ${err?.name || 'Error'}: ${err?.message || String(err)}`;
      setMsg(technical);
      setDebugStage(stage);
    }
  };

  const reset = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setState('idle');
    setMsg('');
    setProgress('');
    setDebugStage('');
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => addFiles(e.target.files)} />

      {/* IN-APP BROWSER WARNING */}
      {typeof navigator !== 'undefined' && isInAppBrowser() && state !== 'loading' && (
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3 mb-3">
          <p className="text-sm font-bold text-yellow-800">⚠️ Camera may not work here</p>
          <p className="text-xs text-yellow-700 mt-1">
            You opened this from an app (Facebook/Instagram/etc). Tap the <b>⋯</b> or <b>Share</b> icon and choose <b>"Open in Safari"</b> or <b>"Open in Browser"</b> for scanning to work.
          </p>
        </div>
      )}

      {/* IDLE — camera first */}
      {state === 'idle' && (
        <div>
          {(title || hint) && (
            <div className="mb-3">
              {title && <p className="text-sm font-bold text-text">{title}</p>}
              {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-green-300 bg-green-50 p-6 hover:bg-green-100 active:scale-95 transition-all">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-200">
                <Camera className="h-7 w-7 text-green-700" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-green-800">Take Photo</p>
                <p className="text-xs text-green-600 mt-0.5">Use camera</p>
              </div>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-6 hover:border-accent hover:bg-red-50 active:scale-95 transition-all">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Upload className="h-7 w-7 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-700">Upload File</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF or photos</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW — show thumbnails, allow adding more pages */}
      {state === 'preview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text">{images.length} page{images.length > 1 ? 's' : ''} ready</p>
            <button onClick={reset} className="text-xs text-muted hover:text-accent flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />Start over
            </button>
          </div>

          {/* Thumbnail grid */}
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-[3/4]">
                <img src={img.url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">{i + 1}</div>
                <button onClick={() => remove(i)} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* Add more pages button */}
            <button onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 aspect-[3/4] hover:border-accent hover:bg-red-50 transition-all active:scale-95">
              <Plus className="h-6 w-6 text-gray-400" />
              <span className="text-[10px] text-gray-400 mt-1">Add page</span>
            </button>
          </div>

          {/* Submit button */}
          <button onClick={submit} className="btn btn-accent btn-full py-4 text-base gap-2">
            <Send className="h-5 w-5" />
            Submit {images.length} page{images.length > 1 ? 's' : ''} to AI
          </button>
        </div>
      )}

      {/* LOADING */}
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 py-10 px-5">
          <Loader2 className="h-12 w-12 text-accent animate-spin" />
          <div className="text-center">
            <p className="font-bold text-gray-900 text-lg">AI is reading your report…</p>
            <p className="text-gray-500 text-sm mt-1">{progress}</p>
          </div>
          <div className="flex gap-1.5 mt-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* DONE */}
      {state === 'done' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-green-300 bg-green-50 py-8 px-5">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <div className="text-center">
            <p className="font-bold text-green-800 text-lg">Done! Data saved.</p>
            <p className="text-green-600 text-sm mt-0.5">{msg}</p>
          </div>
          <button onClick={reset} className="mt-1 text-sm text-green-700 font-semibold underline">
            Scan another report
          </button>
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50 py-8 px-5">
          <AlertCircle className="h-10 w-10 text-accent" />
          <div className="text-center w-full">
            <p className="font-bold text-accent text-lg">Upload failed</p>
            <p className="text-red-700 text-xs mt-2 max-w-xs mx-auto font-mono bg-red-100 rounded-xl px-3 py-2 break-words">{msg}</p>
            <p className="text-gray-500 text-xs mt-2">Screenshot this and send it to support — it shows exactly what went wrong.</p>
          </div>
          <button onClick={reset} className="btn btn-accent text-sm px-8 mt-1">Try again</button>
        </div>
      )}
    </div>
  );
}
