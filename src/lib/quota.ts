import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clientIp, visitorKey } from "./visitor";

// Quotas live in the database (see supabase/migrations/004). This file only
// asks it for permission before every AI call; it never decides on its own.

export type QuotaResult =
  | { allowed: true; remaining: number }
  | { allowed: false; message: string };

const MESSAGES: Record<string, string> = {
  visitor_limit:
    "You've used today's free captions. Sign in for more, or come back tomorrow.",
  user_limit: "You've reached today's caption limit. It resets at midnight UTC.",
  busy: "The Studio is at capacity right now. Please try again a little later.",
  unavailable: "Captions are unavailable right now. Please try again later.",
  auth: "Please sign in to continue.",
};

type Rpc = { allowed?: boolean; remaining?: number; reason?: string | null };

function toResult(data: Rpc | null, error: unknown, where: string): QuotaResult {
  if (error || !data) {
    console.error(`${where} failed (is migration 004 applied?):`, error);
    return { allowed: false, message: MESSAGES.unavailable };
  }
  if (data.allowed) return { allowed: true, remaining: Number(data.remaining ?? 0) };
  return { allowed: false, message: MESSAGES[data.reason ?? ""] ?? MESSAGES.unavailable };
}

function quotaSecret() {
  const secret = process.env.GUEST_QUOTA_SECRET;
  if (!secret || secret.length < 24) {
    console.error("GUEST_QUOTA_SECRET is not set (or shorter than 24 characters).");
    return null;
  }
  return secret;
}

// Signed-in users: the database knows who they are (auth.uid()); the secret
// proves the call came from our server, so members can't spend the shared
// budget by calling the function directly.
export async function consumeUserQuota(): Promise<QuotaResult> {
  const secret = quotaSecret();
  if (!secret) return { allowed: false, message: MESSAGES.unavailable };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_user_quota", { p_secret: secret });
  return toResult(data as Rpc | null, error, "consume_user_quota");
}

// Guests: keyed by a salted hash of the network address, and gated by a shared
// secret so the public anon key alone cannot spend the budget. Fails closed
// when the secret is not configured.
export async function consumeGuestQuota(): Promise<QuotaResult> {
  const secret = quotaSecret();
  if (!secret) return { allowed: false, message: MESSAGES.unavailable };
  const ip = clientIp(await headers());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_guest_quota", {
    p_secret: secret,
    p_visitor: visitorKey(ip, secret),
  });
  return toResult(data as Rpc | null, error, "consume_guest_quota");
}
