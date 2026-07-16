import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves which store a request should act on, now that one account can
 * own multiple stores. Previously every route just did
 * `.eq('owner_id', userId).maybeSingle()`, which silently breaks the moment
 * an account has more than one store (maybeSingle errors/returns null on
 * multiple matches).
 *
 * - If storeId is provided, verifies it actually belongs to this user
 *   (security: prevents acting on someone else's store) and returns it.
 * - If not provided, falls back to the user's first store (oldest first)
 *   for backward compatibility with any caller not yet updated to send
 *   store_id explicitly.
 */
export async function getActiveStore(sb: SupabaseClient, userId: string, storeId?: string | null) {
  if (storeId) {
    const { data, error } = await sb.from('stores').select('*').eq('id', storeId).eq('owner_id', userId).maybeSingle();
    if (error) return { store: null, error: error.message };
    if (!data) return { store: null, error: 'Store not found or not yours' };
    return { store: data, error: null };
  }

  const { data, error } = await sb.from('stores').select('*').eq('owner_id', userId).order('created_at', { ascending: true }).limit(1);
  if (error) return { store: null, error: error.message };
  if (!data || data.length === 0) return { store: null, error: 'No store found' };
  return { store: data[0], error: null };
}
