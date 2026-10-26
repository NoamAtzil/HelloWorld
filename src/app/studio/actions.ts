"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectImageType } from "@/lib/image";
import { getChallenge } from "@/lib/drop-server";
import { generateTakes as askForTakes, remixCaption as askForRemix, MODEL } from "@/lib/gemini";
import { logGeneration } from "@/lib/generation-log";
import { findLibraryItem } from "@/lib/library";
import { consumeGuestQuota, consumeUserQuota } from "@/lib/quota";
import type { PublishResult, RemixResult, TakesResult } from "@/lib/studio-types";
import { DEFAULT_VOICE, isRemixMode, isVoiceId } from "@/lib/voices";

const DEFAULT_INSTRUCTION = "Write a funny caption for this photo.";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Guests send smaller images: it keeps every free request cheap.
const MAX_GUEST_IMAGE_BYTES = 1_600_000;

const AI_ERRORS = {
  incomplete: "The captions came back incomplete or blocked. Try again.",
  empty: "The model returned no captions for that photo. Try another.",
  failed: "Could not generate captions right now. Try again.",
} as const;

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

// GENERATE: works for guests and signed-in users. Nothing is saved; the quota
// is checked (and spent) in the database before Gemini is called.
export async function generateTakes(formData: FormData): Promise<TakesResult> {
  const { userId } = await currentUserId();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to caption." };
  }
  const limit = userId ? MAX_IMAGE_BYTES : MAX_GUEST_IMAGE_BYTES;
  if (file.size > limit) {
    return { ok: false, error: `That photo is too large. The limit is ${userId ? 4 : 1.5} MB.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return { ok: false, error: "Unsupported file type. Please use a JPEG, PNG, or WebP image." };
  }

  const direction = String(formData.get("prompt") ?? "").trim() || DEFAULT_INSTRUCTION;
  if (direction.length > 200) {
    return { ok: false, error: "Keep the instruction to 200 characters or fewer." };
  }
  const rawVoice = formData.get("voice");
  const voice = isVoiceId(rawVoice) ? rawVoice : DEFAULT_VOICE;

  const quota = userId ? await consumeUserQuota() : await consumeGuestQuota();
  if (!quota.allowed) {
    return { ok: false, error: quota.message };
  }

  const slugItem = findLibraryItem(String(formData.get("slug") ?? ""));
  const started = Date.now();
  const result = await askForTakes({ bytes, mimeType: type.mimeType, voice, direction });
  await logGeneration({
    kind: "takes",
    voice,
    direction,
    source: slugItem ? "library" : "upload",
    slug: slugItem?.file ?? null,
    ok: !("error" in result),
    errorCode: "error" in result ? result.error : undefined,
    latencyMs: Date.now() - started,
    meta: result.meta,
  });
  if ("error" in result) {
    return { ok: false, error: AI_ERRORS[result.error] };
  }
  return { ok: true, takes: result.takes, remaining: quota.remaining };
}

// REMIX: rewrite one caption. Signed-in users only (it is a text-only call but
// still spends AI quota).
export async function remixCaption(formData: FormData): Promise<RemixResult> {
  const { userId } = await currentUserId();
  if (!userId) {
    return { ok: false, error: "Sign in to remix captions.", needsLogin: true };
  }
  const caption = String(formData.get("caption") ?? "").trim();
  const mode = formData.get("mode");
  const rawVoice = formData.get("voice");
  if (!caption || caption.length > 500 || !isRemixMode(mode)) {
    return { ok: false, error: "That caption can't be remixed." };
  }

  const quota = await consumeUserQuota();
  if (!quota.allowed) return { ok: false, error: quota.message };

  const remixVoice = isVoiceId(rawVoice) ? rawVoice : null;
  const started = Date.now();
  const result = await askForRemix({ caption, mode, voice: remixVoice });
  await logGeneration({
    kind: "remix",
    voice: remixVoice,
    direction: mode,
    source: null,
    slug: null,
    ok: !("error" in result),
    errorCode: "error" in result ? result.error : undefined,
    latencyMs: Date.now() - started,
    meta: result.meta,
  });
  if ("error" in result) return { ok: false, error: AI_ERRORS[result.error] };
  return { ok: true, caption: result.caption, remaining: quota.remaining };
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /column .* (does not exist|of relation)/i.test(error?.message ?? "")
  );
}

// PUBLISH: separate from generating. Signed-in users only. Saves the photo
// privately, optionally shares a public copy (an explicit choice), and, for
// the Daily Drop, validates the challenge on the server.
export async function publishCaption(formData: FormData): Promise<PublishResult> {
  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return { ok: false, error: "Sign in to publish.", needsLogin: true };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "The photo is missing. Generate again to continue." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "That photo is too large. The limit is 4 MB." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "Unsupported file type." };

  const content = String(formData.get("caption") ?? "").trim();
  if (content.length < 1 || content.length > 500) {
    return { ok: false, error: "The caption must be 1–500 characters." };
  }
  const prompt = String(formData.get("prompt") ?? "").trim() || DEFAULT_INSTRUCTION;
  if (prompt.length > 200) return { ok: false, error: "The instruction is too long." };

  const rawVoice = formData.get("voice");
  const voice = isVoiceId(rawVoice) ? rawVoice : null;
  const share = formData.get("share") === "1";
  const wantsDrop = formData.get("drop") === "1";

  // The slug only counts if it names a real library image.
  const slugItem = findLibraryItem(String(formData.get("slug") ?? ""));
  const slug = slugItem?.file ?? null;

  let drop: string | null = null;
  if (wantsDrop) {
    const challenge = await getChallenge(supabase);
    if (!challenge.item || challenge.item.file !== slug) {
      return { ok: false, error: "That isn't today's challenge photo." };
    }
    drop = challenge.date;
  }

  const imagePath = `${userId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(imagePath, bytes, { contentType: type.mimeType });
  if (uploadError) {
    console.error("Image upload failed:", uploadError);
    return { ok: false, error: "The photo could not be saved. Try again." };
  }

  if (share) {
    const { error: sharedError } = await supabase.storage
      .from("shared-images")
      .upload(imagePath, bytes, { contentType: type.mimeType });
    if (sharedError) {
      console.error("Shared image upload failed (is migration 004 applied?):", sharedError);
      await supabase.storage.from("post-images").remove([imagePath]);
      return { ok: false, error: "Public sharing isn't available yet. Publish without sharing, or try later." };
    }
  }

  const base = { user_id: userId, prompt, content, image_path: imagePath, model: MODEL };
  const extended = { ...base, voice, library_slug: slug, is_public: share, drop_date: drop };

  let { data, error } = await supabase.from("generations").insert(extended).select("id").single();
  if (error && isMissingColumn(error) && !share && !wantsDrop) {
    // Database migration 004 isn't applied yet: still publish the basics.
    ({ data, error } = await supabase.from("generations").insert(base).select("id").single());
  }

  if (error || !data) {
    console.error("Saving generation failed:", error);
    await supabase.storage.from("post-images").remove([imagePath]);
    if (share) await supabase.storage.from("shared-images").remove([imagePath]);
    const message =
      error?.code === "23505"
        ? "You've already entered today's Drop."
        : error?.code === "22023"
          ? "Today's Drop has changed. Refresh and try again."
          : "Your caption was generated but could not be saved.";
    return { ok: false, error: message };
  }

  for (const path of ["/feed", "/dashboard", "/hall", "/arena", "/drop", "/"]) revalidatePath(path);
  return { ok: true, id: data.id as number, shared: share, drop: !!drop };
}
