import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request so Server
// Components always see a valid (non-expired) session. Route-level
// protection (redirecting unauthenticated users) happens in the pages
// themselves, not here — see src/app/dashboard/page.tsx and
// src/app/profile/page.tsx.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() — this
  // triggers the token refresh that keeps the session cookie valid.
  const { data } = await supabase.auth.getClaims();

  // /feed streams behind a loading skeleton, so a redirect issued from the page
  // would arrive after a 200 status. Redirect signed-out visitors here instead,
  // before anything renders, so they get a real 307 (the page still checks the
  // session itself as a second guard).
  const { pathname } = request.nextUrl;
  if (!data?.claims && (pathname === "/feed" || pathname.startsWith("/feed/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Keep any cookies the session refresh just set.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}
