'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VENDORS } from '@/lib/utils';

export interface Store {
  id: string; owner_id: string; name: string; address: string | null;
  city: string | null; state: string | null; phone: string | null;
  email: string | null; tax_rate: number; plan: string;
}

const ACTIVE_STORE_KEY = 'ra_active_store_id';

export function useStore() {
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await sb.from('stores').select('*').eq('owner_id', user.id).order('created_at');
    const list = (data as Store[]) ?? [];

    if (list.length === 0) {
      // Create first store
      const name = user.email ? `${user.email.split('@')[0]}'s Store` : 'My Store';
      const { data: created } = await sb.from('stores').insert({ owner_id: user.id, name }).select('*').single();
      if (created) {
        await sb.from('vendors').insert(VENDORS.map(v => ({ store_id: created.id, company_name: v, is_preset: true })));
        setStores([created as Store]);
        setStore(created as Store);
        localStorage.setItem(ACTIVE_STORE_KEY, created.id);
      }
    } else {
      setStores(list);
      // Restore last active store
      const savedId = localStorage.getItem(ACTIVE_STORE_KEY);
      const active = list.find(s => s.id === savedId) ?? list[0];
      setStore(active);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const switchStore = (storeId: string) => {
    const found = stores.find(s => s.id === storeId);
    if (found) {
      setStore(found);
      localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    }
  };

  const createStore = async (name: string) => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('stores').insert({ owner_id: user.id, name }).select('*').single();
    if (data) {
      await sb.from('vendors').insert(VENDORS.map(v => ({ store_id: data.id, company_name: v, is_preset: true })));
      const newList = [...stores, data as Store];
      setStores(newList);
      setStore(data as Store);
      localStorage.setItem(ACTIVE_STORE_KEY, data.id);
    }
    return data;
  };

  const refetch = fetchStores;

  return { store, stores, loading, switchStore, createStore, refetch };
}
