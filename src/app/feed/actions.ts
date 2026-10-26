"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Result of vote / delete actions: a short, friendly message on failure.
// Raw database errors are only logged on the server.
export type ActionResult = { error?: string };

const VOTE_ERROR = "Couldn't save your vote. Please try again.";
const DELETE_ERROR = "Couldn't delete that post. Refresh and try again.";

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  return { supabase, userId };
}

export async function setVote(formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await requireUserId();

  const generationId = Number(formData.get("generation_id"));
  const value = Number(formData.get("value"));
  if (!Number.isInteger(generationId) || generationId < 1) {
    return { error: VOTE_ERROR };
  }
  if (value !== 1 && value !== -1) return { error: VOTE_ERROR };

  // One vote per user per post (unique user_id + generation_id in the DB):
  // no vote -> insert, same arrow again -> remove, other arrow -> switch.
  const { data: existing, error: readError } = await supabase
    .from("votes")
    .select("value")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error("Reading vote failed:", readError);
    return { error: VOTE_ERROR };
  }

  let writeError;
  if (!existing) {
    ({ error: writeError } = await supabase
      .from("votes")
      .insert({ user_id: userId, generation_id: generationId, value }));
  } else if (existing.value === value) {
    ({ error: writeError } = await supabase
      .from("votes")
      .delete()
      .eq("generation_id", generationId)
      .eq("user_id", userId));
  } else {
    ({ error: writeError } = await supabase
      .from("votes")
      .update({ value })
      .eq("generation_id", generationId)
      .eq("user_id", userId));
  }

  if (writeError) {
    console.error("Saving vote failed:", writeError);
  }

  // Refresh either way so the page always shows what is really saved.
  for (const path of ["/feed", "/drop", "/hall", "/dashboard"]) revalidatePath(path);
  if (writeError?.code === "22023") {
    return { error: "Voting on that Daily Drop is closed." };
  }
  if (writeError?.code === "42501") {
    return { error: "You can't vote on your own Daily Drop entry." };
  }
  return writeError ? { error: VOTE_ERROR } : {};
}

export async function deletePost(formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await requireUserId();

  const generationId = Number(formData.get("generation_id"));
  if (!Number.isInteger(generationId) || generationId < 1) {
    return { error: DELETE_ERROR };
  }

  // RLS only lets a user delete their own rows; the user_id filter is a
  // second guard. Votes go with the row via the foreign-key cascade.
  const { data: deleted, error } = await supabase
    .from("generations")
    .delete()
    .eq("id", generationId)
    .eq("user_id", userId)
    .select("image_path");

  if (error) {
    console.error("Deleting generation failed:", error);
    return { error: DELETE_ERROR };
  }

  // Nothing was deleted (RLS hid the row, or it is already gone): the post is
  // still there for this user, so report it instead of pretending it worked.
  if (!deleted || deleted.length === 0) {
    revalidatePath("/feed");
    return { error: DELETE_ERROR };
  }

  // Remove the photo too (Storage policy: own folder only), including the
  // public copy if the post was shared.
  const imagePath = deleted?.[0]?.image_path;
  if (imagePath) {
    const { error: removeError } = await supabase.storage
      .from("post-images")
      .remove([imagePath]);
    if (removeError) {
      console.error("Deleting post image failed:", removeError);
    }
    const { error: sharedError } = await supabase.storage
      .from("shared-images")
      .remove([imagePath]);
    if (sharedError) {
      console.error("Deleting shared image failed:", sharedError);
    }
  }

  for (const path of ["/feed", "/drop", "/hall", "/dashboard", "/"]) revalidatePath(path);
  return {};
}
