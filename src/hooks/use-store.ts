'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VENDORS } from '@/lib/utils';

export interface Store {
  id: string; owner_id: string; name: string; address: string | null;
  city: string | null; state: string | null; phone: string | null;
  email: string | null; tax_rate: number; plan: string;
}

const KEY = 'ra_active_store_id';

// Safe localStorage helpers — never crash on SSR or private browsing
const getStored = (): string | null => {
  try { return typeof window !== 'undefined' ? localStorage.getItem(KEY) : null; }
  catch { return null; }
};
const setStored = (id: string): void => {
  try { if (typeof window !== 'undefined') localStorage.setItem(KEY, id); }
  catch { /* ignore */ }
};

export function useStore() {
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await sb.from('stores').select('*').eq('owner_id', user.id).order('created_at');
      if (error) throw error;

      const list = (data as Store[]) ?? [];

      if (list.length === 0) {
        // First login — create default store
        const name = user.email ? `${user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ')}'s Store` : 'My Store';
        const { data: created, error: cErr } = await sb.from('stores').insert({ owner_id: user.id, name }).select('*').single();
        if (cErr) throw cErr;
        if (created) {
          // Seed vendors in background — don't block
          sb.from('vendors').insert(VENDORS.map(v => ({ store_id: created.id, company_name: v, is_preset: true }))).then(() => {});
          setStores([created as Store]);
          setStore(created as Store);
          setStored(created.id);
        }
      } else {
        setStores(list);
        const savedId = getStored();
        const active = list.find(s => s.id === savedId) ?? list[0];
        setStore(active);
      }
    } catch (err) {
      console.error('useStore fetchStores error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const switchStore = useCallback((storeId: string) => {
    const found = stores.find(s => s.id === storeId);
    if (found) {
      setStore(found);
      setStored(storeId);
    }
  }, [stores]);

  const createStore = useCallback(async (name: string): Promise<Store | null> => {
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;

      const { data, error } = await sb.from('stores').insert({ owner_id: user.id, name: name.trim() }).select('*').single();
      if (error) throw error;
      if (!data) return null;

      const newStore = data as Store;

      // Seed vendors for new store in background
      sb.from('vendors').insert(VENDORS.map(v => ({ store_id: newStore.id, company_name: v, is_preset: true }))).then(() => {});

      // Update state
      setStores(prev => [...prev, newStore]);
      setStore(newStore);
      setStored(newStore.id);

      return newStore;
    } catch (err) {
      console.error('createStore error:', err);
      return null;
    }
  }, []);

  const refetch = fetchStores;

  return { store, stores, loading, switchStore, createStore, refetch };
}
