import { SupabaseClient } from '@supabase/supabase-js';

export async function getValidGmailToken(sb: SupabaseClient, storeId: string): Promise<{ token: string; email: string } | null> {
  const { data: conn } = await sb.from('email_connections').select('*').eq('store_id', storeId).eq('provider', 'google').maybeSingle();
  if (!conn) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  const isExpired = Date.now() > expiresAt - 60_000; // refresh 1 min early

  if (!isExpired) return { token: conn.access_token, email: conn.email_address };

  if (!conn.refresh_token) return null; // can't refresh, user needs to reconnect

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

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
    console.error('Gmail token refresh failed:', await res.text().catch(() => ''));
    return null;
  }

  const tokens = await res.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const { error } = await sb.from('email_connections')
    .update({ access_token: tokens.access_token, expires_at: newExpiresAt })
    .eq('store_id', storeId).eq('provider', 'google');
  if (error) console.error('token refresh save failed (non-fatal):', error);

  return { token: tokens.access_token, email: conn.email_address };
}
