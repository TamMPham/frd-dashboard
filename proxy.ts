import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public surfaces: login, the OAuth callback, and the digest email's token
// pages (/t/*) — there the signed single-use nonce is the auth, so Peter can
// act straight from an email without signing in.
const PUBLIC_PATHS = [/^\/login/, /^\/auth\//, /^\/t\//];

export default async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const isPublic = PUBLIC_PATHS.some((re) =>
    re.test(request.nextUrl.pathname),
  );
  if (!url || !key) {
    // Auth not configured yet — everything but the public pages bounces to
    // /login, which explains what to set up.
    if (isPublic) return NextResponse.next();
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }

  // Standard @supabase/ssr session refresh (their docs call this middleware;
  // in Next 16 the same code lives in proxy.ts).
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Skip static assets and /api/* (rewritten to the backend, which does its
  // own JWT check — a redirect-to-login would corrupt JSON responses).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
