import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) redirect('/home');
  } catch { /* ignore */ }
  redirect('/login');
}
