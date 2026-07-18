import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function GET(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const requestedStoreId = req.nextUrl.searchParams.get('store_id');
  const { store, error: storeErr } = await getActiveStore(sb, user.id, requestedStoreId);
  if (!store) return NextResponse.redirect(new URL('/email?error=no_store', req.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL('/email?error=not_configured', req.url));
  }

  const { origin } = new URL(req.url);
  const redirectUri = `${origin}/api/email/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // ensures we get a refresh_token every time
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    state: `${user.id}:${store.id}`,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
