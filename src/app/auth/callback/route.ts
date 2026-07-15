import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VENDORS } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const sb = createClient();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    console.error('auth callback exchange failed:', error);
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  // Now that the user is genuinely authenticated, create their store if it
  // doesn't exist yet. The intended store name was stashed in user metadata
  // at signup time — this avoids creating a store before email confirmation
  // succeeds, which was silently leaving confirmed users with no store at all.
  const { data: existingStore } = await sb.from('stores').select('id').eq('owner_id', data.user.id).maybeSingle();

  if (!existingStore) {
    const storeName = (data.user.user_metadata?.store_name as string) || 'My Store';
    const { data: newStore, error: storeErr } = await sb.from('stores')
      .insert({ owner_id: data.user.id, name: storeName.trim() })
      .select('id').single();

    if (storeErr) {
      console.error('store creation failed in auth callback:', storeErr);
      return NextResponse.redirect(`${origin}/login?error=store_setup_failed`);
    }

    if (newStore) {
      const { error: vendorErr } = await sb.from('vendors').insert(
        VENDORS.map((v: string) => ({ store_id: newStore.id, company_name: v, is_preset: true }))
      );
      if (vendorErr) console.error('preset vendor creation failed (non-fatal):', vendorErr);
    }
  }

  return NextResponse.redirect(`${origin}/home`);
}
