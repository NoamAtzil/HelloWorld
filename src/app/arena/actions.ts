"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadArenaPair, type ArenaPair, type ArenaReveal } from "./pair";

export type NextPairResult = { ok: true; pair: ArenaPair | null } | { ok: false; error: string };
export type VoteResult = { ok: true; reveal: ArenaReveal } | { ok: false; error: string };

export async function nextPair(): Promise<NextPairResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "Sign in to play." };
  const result = await loadArenaPair(supabase);
  return result.error ? { ok: false, error: "Couldn't load the next battle." } : { ok: true, pair: result.pair };
}

export async function castDuelVote(winnerId: number, loserId: number): Promise<VoteResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { ok: false, error: "Sign in to vote." };
  if (!Number.isInteger(winnerId) || !Number.isInteger(loserId)) {
    return { ok: false, error: "That battle isn't valid." };
  }

  const { data, error } = await supabase.rpc("arena_vote", { p_winner: winnerId, p_loser: loserId });
  if (error) {
    console.error("arena_vote failed:", error);
    const message =
      error.code === "23505"
        ? "You already judged that pair."
        : error.code === "42501"
          ? "You can't judge your own caption."
          : "Couldn't record your vote. Try again.";
    return { ok: false, error: message };
  }
  revalidatePath("/hall");
  revalidatePath("/dashboard");
  return { ok: true, reveal: data as ArenaReveal };
}
