import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { POST_LOGIN_COOKIE, safeNextPath } from "@/lib/next-path";

// Required callback route for the OAuth authorization-code flow: Supabase
// redirects the browser here with a `code` after the user approves access
// with Google. We exchange that code for a session, then send first-time
// users to complete their profile.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", claims?.sub)
    .single();

  // A visitor who started something (e.g. a caption in the Studio) before
  // signing in returns to it; the cookie is validated and then cleared.
  const cookieStore = await cookies();
  let wanted: string | null = null;
  try {
    wanted = safeNextPath(decodeURIComponent(cookieStore.get(POST_LOGIN_COOKIE)?.value ?? ""));
  } catch {
    wanted = null;
  }
  cookieStore.delete(POST_LOGIN_COOKIE);

  const destination =
    profile?.first_name && profile?.last_name ? (wanted ?? "/dashboard") : "/profile";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const base = isLocalEnv
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  return NextResponse.redirect(`${base}${destination}`);
}
