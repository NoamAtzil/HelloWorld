import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Photo } from "@/components/photo";
import { Studio } from "@/components/studio";
import { WinnerCard } from "@/components/winner-card";
import { dropDate, formatDropDate, shiftDate } from "@/lib/drop";
import { getChallenge } from "@/lib/drop-server";
import { libraryUrl } from "@/lib/library";
import { signImages, toFeedPost, type PostRow } from "@/lib/posts";
import { DropEntries } from "./drop-entries";

export const metadata: Metadata = {
  title: "Daily Drop — caption",
  description: "One photo a day. Everyone captions it. Tonight, one wins.",
};

type WinnerRow = {
  drop_date: string;
  id: number;
  content: string;
  image_path: string;
  voice: string | null;
  score: number | string;
  author_name: string;
};

export default async function DropPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const signedIn = !!auth?.claims;

  const today = dropDate();
  const yesterday = shiftDate(today, -1);
  const challenge = await getChallenge(supabase, today);

  let entries: ReturnType<typeof toFeedPost>[] = [];
  let winner: WinnerRow | null = null;
  let winnerUrl: string | null = null;
  let entryCount: number | null = null;
  let setupMissing = false;

  if (signedIn) {
    const { data, error } = await supabase.rpc("drop_entries", { p_date: today });
    if (error) {
      console.error("drop_entries failed (is migration 004 applied?):", error);
      setupMissing = true;
    }
    const rows = (data ?? []) as PostRow[];
    const { data: winners } = await supabase.rpc("drop_winners", { p_limit: 7 });
    winner = ((winners ?? []) as WinnerRow[]).find((w) => w.drop_date === yesterday) ?? null;
    const urls = await signImages(supabase, [...rows.map((r) => r.image_path), ...(winner ? [winner.image_path] : [])]);
    entries = rows.map((row) => toFeedPost(row, urls));
    winnerUrl = winner ? urls.get(winner.image_path) ?? null : null;
    entryCount = rows.length;
  } else {
    const { data } = await supabase.rpc("drop_summary", { p_date: today });
    entryCount = typeof data === "number" ? data : null;
  }

  const alreadyEntered = entries.some((e) => e.mine);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-24 pt-6">
      <div>
        <p className="text-sm font-semibold text-accent-text">{formatDropDate(today)}</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Daily Drop</h1>
        <p className="mt-1 text-sm text-muted">
          One photo for everyone, every day. Caption it, vote on the others, and the top caption
          wins when the day ends at midnight Eastern Time.
          {challenge.theme ? ` Today's theme: ${challenge.theme}.` : ""}
        </p>
      </div>

      {setupMissing && (
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          The Daily Drop isn&apos;t set up in the database yet. An administrator needs to apply migration 004.
        </p>
      )}

      {!challenge.item ? (
        <p className="glass rounded-2xl p-6 text-center text-muted">No challenge photo is available today.</p>
      ) : signedIn ? (
        <Studio
          signedIn
          challenge={{
            date: today,
            file: challenge.item.file,
            title: challenge.item.title,
            theme: challenge.theme,
          }}
          alreadyEntered={alreadyEntered}
        />
      ) : (
        <div className="glass glass-lit flex flex-col gap-4 rounded-[28px] p-4 sm:p-5">
          <Photo src={libraryUrl(challenge.item.file)} alt={challenge.item.title} size="drop" loading="eager" scrim={false} />
          <p className="text-sm text-muted">
            {entryCount ? `${entryCount} ${entryCount === 1 ? "caption" : "captions"} so far today. ` : "Be the first to caption it. "}
            Sign in to enter, vote and see the entries.
          </p>
          <Link href="/login?next=/drop" className="btn-primary press self-start">
            Sign in to play
          </Link>
        </div>
      )}

      {signedIn && (
        <section aria-labelledby="yesterday" className="flex flex-col gap-3">
          <h2 id="yesterday" className="text-xl font-bold">
            Yesterday&apos;s winner
          </h2>
          {winner ? (
            <WinnerCard
              imageUrl={winnerUrl}
              content={winner.content}
              author={winner.author_name}
              voice={winner.voice}
              score={Number(winner.score)}
              label="Winner"
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              No winner yesterday ({formatDropDate(yesterday)}). A winner needs at least one entry with a positive score.
            </p>
          )}
        </section>
      )}

      {signedIn && (
        <section aria-labelledby="entries" className="flex flex-col gap-4">
          <h2 id="entries" className="text-xl font-bold">
            Today&apos;s entries {entryCount !== null && <span className="text-muted">({entryCount})</span>}
          </h2>
          {entries.length > 0 ? (
            <DropEntries posts={entries} />
          ) : (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No entries yet today. Yours could be the first.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
