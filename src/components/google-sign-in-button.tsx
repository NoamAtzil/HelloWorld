"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignIn() {
    setIsLoading(true);
    setError(null);

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
