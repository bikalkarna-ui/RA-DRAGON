'use client';
import { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIUploadProps {
  label?: string;
  description?: string;
  endpoint: string;
  onResult: (data: any) => void;
  compact?: boolean;
  accept?: string;
  className?: string;
}

export function AIUpload({
  label = 'Upload & AI Scan',
  description = 'PDF or photo — AI reads and extracts data',
  endpoint, onResult, compact = false,
  accept = 'application/pdf,image/*', className,
}: AIUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState('uploading'); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setState('error'); setMsg(data.error || 'Failed'); return; }
      setState('success'); setMsg('Done');
      onResult(data);
      setTimeout(() => setState('idle'), 3000);
    } catch (err: any) {
      setState('error'); setMsg(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (compact) return (
    <div className={className}>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handle} />
      <button onClick={() => fileRef.current?.click()} disabled={state === 'uploading'}
        className={cn('btn btn-ghost text-sm h-10 px-4 gap-2',
          state === 'success' && 'border-green-500/30 text-green-400',
          state === 'error' && 'border-accent/30 text-accent',
        )}>
        {state === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> :
         state === 'success' ? <CheckCircle className="h-4 w-4" /> :
         state === 'error' ? <AlertCircle className="h-4 w-4" /> :
         <Upload className="h-4 w-4" />}
        {state === 'uploading' ? 'AI reading…' : state === 'success' ? 'Done!' : state === 'error' ? 'Failed' : label}
      </button>
      {state === 'error' && msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
    </div>
  );

  return (
    <div className={className}>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handle} />
      <div onClick={() => state === 'idle' && fileRef.current?.click()}
        className={cn('drop-zone', state !== 'idle' && 'pointer-events-none',
          state === 'success' && 'border-green-500/40 bg-green-500/5',
          state === 'error' && 'border-accent/40 bg-accent/5')}>
        {state === 'uploading' ? (
          <><Loader2 className="h-10 w-10 text-accent animate-spin" /><p className="text-text font-semibold">AI is reading your file…</p><p className="text-muted text-sm">This takes a few seconds</p></>
        ) : state === 'success' ? (
          <><CheckCircle className="h-10 w-10 text-green-500" /><p className="text-green-400 font-semibold">Extracted successfully!</p></>
        ) : state === 'error' ? (
          <><AlertCircle className="h-10 w-10 text-accent" /><p className="text-accent font-semibold">Failed</p><p className="text-muted text-sm">{msg}</p><button onClick={() => setState('idle')} className="text-xs text-accent/70 hover:text-accent">Try again</button></>
        ) : (
          <><Upload className="h-10 w-10 text-dim" /><p className="text-text font-semibold text-lg">{label}</p><p className="text-muted text-sm">{description}</p><span className="chip-gray">PDF · JPG · PNG</span></>
        )}
      </div>
    </div>
  );
}
