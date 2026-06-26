import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
const PUBLIC = ['/', '/login', '/register'];
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(n: string) { return req.cookies.get(n)?.value; },
      set(n: string, v: string, o: CookieOptions) { res.cookies.set({ name: n, value: v, ...o }); },
      remove(n: string, o: CookieOptions) { res.cookies.set({ name: n, value: '', ...o }); },
    }
  });
  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const pub = PUBLIC.includes(path) || path.startsWith('/api/');
  if (!user && !pub) return NextResponse.redirect(new URL('/login', req.url));
  if (user && (path === '/login' || path === '/register')) return NextResponse.redirect(new URL('/home', req.url));
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'] };
