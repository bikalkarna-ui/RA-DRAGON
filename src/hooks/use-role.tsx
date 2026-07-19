'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ViewRole = 'owner' | 'manager' | 'employee';

interface RoleContextValue {
  role: ViewRole;
  ready: boolean;
  // Attempts to switch into manager or employee view using a staff PIN.
  // Returns an error string on failure, or null on success.
  switchWithPin: (targetRole: 'manager' | 'employee', pin: string, storeId: string) => Promise<string | null>;
  // Returns to owner view — requires the store's dedicated owner PIN.
  returnToOwner: (ownerPin: string, storeId: string) => Promise<string | null>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const SESSION_KEY = 'ra_view_role';

// Job-title labels that count as "manager tier" when determining what an
// employee's PIN unlocks. Everything else (Cashier, Stock Clerk, etc.)
// is employee tier.
const MANAGER_TITLES = ['manager', 'assistant manager'];

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<ViewRole>('owner');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved === 'manager' || saved === 'employee') setRole(saved);
    } catch { /* private browsing — default to owner */ }
    setReady(true);
  }, []);

  const persist = useCallback((next: ViewRole) => {
    setRole(next);
    try {
      if (next === 'owner') sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, next);
    } catch { /* ignore */ }
  }, []);

  const switchWithPin = useCallback(async (targetRole: 'manager' | 'employee', pin: string, storeId: string) => {
    if (role === 'employee') {
      // Employees cannot switch into any other role via the switcher at all.
      return 'Role not assigned';
    }
    if (!pin || pin.length !== 4) return 'Enter a 4-digit PIN';

    const sb = createClient();
    const { data: employees, error } = await sb.from('employees')
      .select('id, name, role, pin').eq('store_id', storeId).eq('pin', pin.trim()).eq('is_active', true);

    if (error) return 'Could not verify PIN — please try again';
    if (!employees || employees.length === 0) return 'PIN not recognized';

    const match = employees[0];
    const isManagerPin = MANAGER_TITLES.includes((match.role || '').toLowerCase());

    if (targetRole === 'manager' && !isManagerPin) {
      return 'This PIN belongs to an employee, not a manager';
    }

    persist(targetRole);
    return null;
  }, [role, persist]);

  const returnToOwner = useCallback(async (ownerPin: string, storeId: string) => {
    if (!ownerPin) return 'Enter the owner PIN';
    const sb = createClient();
    const { data: store, error } = await sb.from('stores').select('owner_pin').eq('id', storeId).maybeSingle();
    if (error) return 'Could not verify — please try again';
    if (!store?.owner_pin) return 'No owner PIN set yet — set one in Settings first';
    if (store.owner_pin !== ownerPin.trim()) return 'Incorrect owner PIN';
    persist('owner');
    return null;
  }, [persist]);

  return (
    <RoleContext.Provider value={{ role, ready, switchWithPin, returnToOwner }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}
