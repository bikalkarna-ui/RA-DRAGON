import { SupabaseClient } from '@supabase/supabase-js';

type GmailResult = { token: string; email: string; reason?: undefined } | { token?: undefined; email?: undefined; reason: string };

export async function getValidGmailToken(sb: SupabaseClient, storeId: string): Promise<GmailResult> {
  const { data: conn, error: connErr } = await sb.from('email_connections').select('*').eq('store_id', storeId).eq('provider', 'google').maybeSingle();
  if (connErr) {
    console.error('email_connections lookup failed:', connErr);
    return { reason: `Database error looking up your Gmail connection: ${connErr.message}` };
  }
  if (!conn) return { reason: 'No Gmail connection found — click Connect Gmail below.' };

  const expiresAt = new Date(conn.expires_at).getTime();
  const isExpired = Date.now() > expiresAt - 60_000; // refresh 1 min early

  if (!isExpired) return { token: conn.access_token, email: conn.email_address };

  if (!conn.refresh_token) return { reason: 'Your Gmail connection expired and can\'t auto-refresh. Please reconnect.' };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { reason: 'Gmail integration is not configured on the server (missing credentials).' };

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('Gmail token refresh failed:', errText);
    return { reason: 'Could not refresh your Gmail connection — please reconnect.' };
  }

  const tokens = await res.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const { error } = await sb.from('email_connections')
    .update({ access_token: tokens.access_token, expires_at: newExpiresAt })
    .eq('store_id', storeId).eq('provider', 'google');
  if (error) console.error('token refresh save failed (non-fatal):', error);

  return { token: tokens.access_token, email: conn.email_address };
}
