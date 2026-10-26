import type { SupabaseClient } from "@supabase/supabase-js";
import { dropDate, pickChallenge } from "./drop";
import { LIBRARY, type LibraryItem } from "./library";

export type Challenge = { date: string; item: LibraryItem | null; theme: string | null };

// The challenge for a date: an admin-set row in daily_challenges if there is
// one (and it names a real library image), otherwise the deterministic pick.
export async function getChallenge(
  supabase: SupabaseClient,
  date: string = dropDate(),
): Promise<Challenge> {
  const { data } = await supabase
    .from("daily_challenges")
    .select("library_slug, theme")
    .eq("drop_date", date)
    .maybeSingle();
  return {
    date,
    item: pickChallenge(date, LIBRARY, data?.library_slug ?? null),
    theme: data?.theme ?? null,
  };
}
