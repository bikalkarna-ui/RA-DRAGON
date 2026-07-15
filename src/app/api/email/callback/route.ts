import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  if (!code || !userId) {
    return NextResponse.redirect(`${origin}/email?error=missing_code`);
  }

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/email?error=not_configured`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/email/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.error('Gmail token exchange failed:', errText);
      return NextResponse.redirect(`${origin}/email?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    // tokens: { access_token, refresh_token, expires_in, scope, token_type }

    // Fetch the connected email address for display purposes
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : {};

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.redirect(`${origin}/email?error=no_store`);

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    // Google only returns a refresh_token on the very first consent for a
    // given app+user. On reconnect it may be omitted — don't let that wipe
    // out a previously working refresh_token.
    let refreshToken = tokens.refresh_token ?? null;
    if (!refreshToken) {
      const { data: existing } = await sb.from('email_connections').select('refresh_token').eq('store_id', store.id).eq('provider', 'google').maybeSingle();
      refreshToken = existing?.refresh_token ?? null;
    }

    const { error } = await sb.from('email_connections').upsert({
      store_id: store.id,
      provider: 'google',
      email_address: profile.email ?? null,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'store_id,provider' });

    if (error) {
      console.error('email_connections upsert failed:', error);
      return NextResponse.redirect(`${origin}/email?error=save_failed`);
    }

    return NextResponse.redirect(`${origin}/email?connected=1`);
  } catch (err) {
    console.error('Gmail callback threw:', err);
    return NextResponse.redirect(`${origin}/email?error=unknown`);
  }
}
