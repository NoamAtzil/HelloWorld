"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { POST_LOGIN_COOKIE, safeNextPath } from "@/lib/next-path";

export function GoogleSignInButton({ next: nextRaw }: { next?: string | null }) {
  const next = safeNextPath(nextRaw);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    setIsLoading(true);
    setError(null);

    // Remember where to go afterwards in a short-lived cookie (not in the
    // redirect URL, which must match Supabase's allow-list exactly).
    if (next) {
      document.cookie = `${POST_LOGIN_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // On success, Supabase redirects the browser to Google — no further
    // action needed here.
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isLoading}
        className="btn-primary press"
      >
        {isLoading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">{error}</p>}
    </div>
  );
}
