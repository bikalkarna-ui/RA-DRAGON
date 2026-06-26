import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export default async function Root() {
  const { data: { user } } = await createClient().auth.getUser();
  redirect(user ? '/home' : '/login');
}
