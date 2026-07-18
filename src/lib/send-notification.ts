import { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('mailto:support@ryxsorai.com', publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends a real push notification to every device subscribed for this store.
 * Safe to call fire-and-forget — never throws, just logs and returns a
 * result summary so callers can optionally check it.
 */
export async function sendStoreNotification(sb: SupabaseClient, storeId: string, title: string, body: string): Promise<{ sent: number; failed: number }> {
  try {
    if (!ensureConfigured()) {
      console.error('sendStoreNotification: VAPID keys not configured, skipping');
      return { sent: 0, failed: 0 };
    }
    const { data: subs, error } = await sb.from('push_subscriptions').select('*').eq('store_id', storeId);
    if (error || !subs?.length) return { sent: 0, failed: 0 };

    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, icon: '/icon-192.png' }));
        sent++;
      } catch (err: any) {
        failed++;
        console.error(`push send failed for subscription ${sub.id}:`, err?.message);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
    return { sent, failed };
  } catch (err) {
    console.error('sendStoreNotification threw:', err);
    return { sent: 0, failed: 0 };
  }
}
