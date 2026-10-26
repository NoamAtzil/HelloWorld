import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { SignInGate } from "@/components/sign-in-gate";
import { signImages, toFeedPost, type PostRow } from "@/lib/posts";
import { MyCaptions, type MyItem } from "./my-captions";

type MyRow = PostRow & {
  upvotes?: number | string;
  downvotes?: number | string;
  arena_wins?: number | string;
  arena_battles?: number | string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <SignInGate title="Your captions" next="/dashboard">
          Everything you&apos;ve published, with scores and Arena results, lives here.
        </SignInGate>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", claims.sub)
    .single();

  if (!profile?.first_name || !profile?.last_name) {
    redirect("/profile");
  }

  // Your posts with real scores and Arena results. Falls back to a plain list
  // if the newer function isn't installed yet.
  let rows: MyRow[] = [];
  const mine = await supabase.rpc("my_captions");
  if (!mine.error) {
    rows = (mine.data ?? []) as MyRow[];
  } else {
    const plain = await supabase
      .from("generations")
      .select("id, prompt, content, image_path, created_at")
      .not("image_path", "is", null)
      .order("created_at", { ascending: false });
    rows = ((plain.data ?? []) as MyRow[]).map((r) => ({ ...r, score: 0 }));
  }

  const urls = await signImages(supabase, rows.map((r) => r.image_path));
  const items: MyItem[] = rows.map((row) => {
    const battles = Number(row.arena_battles ?? 0);
    const wins = Number(row.arena_wins ?? 0);
    return {
      post: toFeedPost({ ...row, mine: true }, urls),
      record: battles > 0 ? `Arena: ${wins} ${wins === 1 ? "win" : "wins"} in ${battles} ${battles === 1 ? "battle" : "battles"}` : "",
    };
  });

  const totalScore = items.reduce((sum, i) => sum + i.post.score, 0);
  const totalWins = rows.reduce((sum, r) => sum + Number(r.arena_wins ?? 0), 0);
  const shared = items.filter((i) => i.post.isPublic).length;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pb-24 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Hi, {profile.first_name}</h1>
          <p className="mt-1 text-sm text-muted">Your captions, with their real scores and Arena results.</p>
        </div>
        <LogoutButton />
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Captions", String(items.length)],
          ["Total score", String(totalScore)],
          ["Arena wins", String(totalWins)],
        ].map(([label, value]) => (
          <div key={label} className="glass rounded-2xl p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {shared > 0 && (
        <p className="-mt-4 text-sm text-muted">
          {shared} of your captions {shared === 1 ? "is" : "are"} shared publicly. Deleting a caption also removes its public copy.
        </p>
      )}

      {items.length > 0 ? (
        <MyCaptions items={items} />
      ) : (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center">
          <p className="text-lg font-semibold">No captions yet.</p>
          <p className="text-sm text-muted">Make your first one in the Studio.</p>
          <Link href="/studio" className="btn-primary press">Open the Studio</Link>
        </div>
      )}
    </main>
  );
}
