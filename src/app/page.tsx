import { createClient } from "@/lib/supabase/server";
import { HomeView, type ShowcaseRow } from "@/components/home-view";
import { dropDate } from "@/lib/drop";
import { getChallenge } from "@/lib/drop-server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  // Logged-out visitors only ever see posts whose author chose to share them
  // publicly (the database function enforces that), plus a count for the Drop.
  const [{ data: showcase }, challenge, { data: dropCount }] = await Promise.all([
    supabase.rpc("public_showcase", { p_limit: 8 }),
    getChallenge(supabase),
    supabase.rpc("drop_summary", { p_date: dropDate() }),
  ]);
  const wall = (showcase ?? []) as ShowcaseRow[];
  const entries = typeof dropCount === "number" ? dropCount : null;

  return <HomeView signedIn={signedIn} wall={wall} challenge={challenge} entries={entries} />;
}
