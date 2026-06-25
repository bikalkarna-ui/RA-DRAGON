'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VENDOR_COMPANIES } from '@/lib/utils';

export interface Store {
  id: string; owner_id: string; name: string; address: string | null;
  city: string | null; state: string | null; phone: string | null;
  email: string | null; tax_rate: number; plan: string;
}

export function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await sb.from('stores').select('*').eq('owner_id', user.id).maybeSingle();
    if (data) { setStore(data as Store); setLoading(false); return; }
    const name = user.email ? `${user.email.split('@')[0]}'s Store` : 'My Store';
    const { data: created } = await sb.from('stores').insert({ owner_id: user.id, name }).select('*').single();
    if (created) {
      setStore(created as Store);
      // Seed vendor companies on first store creation
      await sb.from('vendors').insert(
        VENDOR_COMPANIES.filter(v => v.id !== 'custom').map(v => ({
          store_id: created.id, company_name: v.name, is_preset: true,
          notes: `Pre-built rep for ${v.categories.join(', ')}`,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { store, loading, refetch: fetch };
}
