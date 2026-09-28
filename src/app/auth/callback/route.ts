import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const destination =
    profile?.first_name && profile?.last_name ? "/dashboard" : "/profile";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const base = isLocalEnv
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  return NextResponse.redirect(`${base}${destination}`);
}
