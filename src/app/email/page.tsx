'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Screen } from '@/components/layout/screen';
import { cn } from '@/lib/utils';
import { Mail, RefreshCw, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

export default function EmailPage() {
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectedAs, setConnectedAs] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const params = useSearchParams();

  useEffect(() => { setMounted(true); }, []);

  const [callbackErr, setCallbackErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/email/summarize');
      const data = await res.json();
      if (data.error === 'not_configured' || (res.status === 500 && data.error?.includes('not configured'))) {
        setNeedsSetup(true); setConnected(false); setLoading(false); return;
      }
      if (data.needsReconnect || !res.ok) {
        setConnected(false);
        setCallbackErr(data.error || 'Could not load your Gmail connection — please reconnect.');
        setLoading(false);
        return;
      }
      setConnected(true);
      setConnectedAs(data.connectedAs || '');
      setEmails(data.emails ?? []);
    } catch {
      setErr('Could not load emails');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const errorParam = params.get('error');
    if (errorParam === 'not_configured') setNeedsSetup(true);
    else if (errorParam) setCallbackErr(errorParam);
    load();
  }, [mounted, load, params]);

  if (!mounted) return null;

  return (
    <Screen title="Email Reader" subtitle="AI summaries of your inbox, connected via Gmail">
      {needsSetup ? (
        <div className="tile p-8 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-text mb-2">Gmail connection isn't set up yet</p>
          <p className="text-sm text-muted leading-relaxed">
            This needs a Google OAuth app created in Google Cloud Console, with <code className="bg-surface px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-surface px-1 rounded">GOOGLE_CLIENT_SECRET</code> added to your Vercel environment variables. Ask your developer to finish this setup.
          </p>
        </div>
      ) : connected === false ? (
        <div className="tile p-8 text-center">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-text mb-2">Connect your Gmail</p>
          <p className="text-sm text-muted mb-5">See AI summaries of your inbox right here — no need to open Gmail separately.</p>
          {callbackErr && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 max-w-sm mx-auto">
              Connection failed: {callbackErr}
            </p>
          )}
          <a href="/api/email/connect" className="btn btn-accent inline-flex px-8">Connect Gmail</a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{connectedAs && `Connected as ${connectedAs}`}</p>
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />Refresh
            </button>
          </div>

          {loading && emails.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
          ) : err ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{err}</p>
          ) : emails.length === 0 ? (
            <div className="tile p-8 text-center">
              <Mail className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-muted">No recent emails found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map(e => (
                <a key={e.id} href={`https://mail.google.com/mail/u/0/#inbox/${e.id}`} target="_blank" rel="noopener noreferrer"
                  className="tile p-4 flex items-start gap-3 hover:bg-surface transition-colors block">
                  {e.unread && <span className="h-2 w-2 rounded-full bg-accent shrink-0 mt-2" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm truncate', e.unread ? 'font-bold text-text' : 'font-semibold text-sub')}>{e.from.split('<')[0].trim()}</p>
                      <ExternalLink className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    </div>
                    <p className="text-sm text-text mt-0.5 truncate">{e.subject}</p>
                    <p className="text-xs text-muted mt-1 leading-relaxed">{e.summary}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}
