import { createClient } from "@/lib/supabase/server";
import type { GenerateMeta } from "./gemini";
import { MODEL } from "./gemini";

// Writes one request + one response row for the admin "Generation requests" and
// "LLM responses" pages, via a secret-gated database function. Stores only
// minimal metadata: the typed direction, voice, library image name, model,
// status, timing and the caption text. Never the image, an IP address or a
// secret. Best effort: a logging failure must never break a caption.
export async function logGeneration(args: {
  kind: "takes" | "remix";
  voice: string | null;
  direction: string | null;
  source: "library" | "upload" | null;
  slug: string | null;
  ok: boolean;
  errorCode?: string;
  latencyMs: number;
  meta: GenerateMeta;
}) {
  const secret = process.env.GUEST_QUOTA_SECRET;
  if (!secret || secret.length < 24) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_generation", {
      p_secret: secret,
      p_kind: args.kind,
      p_voice: args.voice ?? "",
      p_direction: args.direction ?? "",
      p_source: args.source ?? "",
      p_slug: args.slug ?? "",
      p_model: MODEL,
      p_status: args.ok ? "ok" : "error",
      p_latency_ms: Math.max(0, Math.round(args.latencyMs)),
      p_response_text: args.meta.text ?? "",
      p_finish_reason: args.meta.finishReason ?? "",
      p_error_code: args.errorCode ?? "",
    });
    if (error) console.error("record_generation failed (is migration 005 applied?):", error.message);
  } catch (error) {
    console.error("record_generation threw:", error);
  }
}
