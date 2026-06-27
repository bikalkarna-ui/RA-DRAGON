import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });
  
  // If env vars missing, allow everything through - don't crash
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return res;
  }

  try {
    const sb = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(n: string) { return req.cookies.get(n)?.value; },
        set(n: string, v: string, o: CookieOptions) { res.cookies.set({ name: n, value: v, ...o }); },
        remove(n: string, o: CookieOptions) { res.cookies.set({ name: n, value: '', ...o }); },
      }
    });

    const { data: { user } } = await sb.auth.getUser();
    const path = req.nextUrl.pathname;
    const isPublic = PUBLIC_PATHS.includes(path) || path.startsWith('/api/');

    if (!user && !isPublic) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (user && (path === '/login' || path === '/register')) {
      return NextResponse.redirect(new URL('/home', req.url));
    }
  } catch {
    // If auth fails for any reason, just let the request through
    // The page itself will handle auth
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)'],
};
