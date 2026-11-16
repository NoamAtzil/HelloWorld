import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { dropGuidance } from "@/lib/guidance";
import { EmptyState } from "@/components/ui";
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

  const guidance = dropGuidance({ signedIn, hasChallenge: Boolean(challenge.item), alreadyEntered, entries: entryCount });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <section className="stage" aria-labelledby="drop-heading">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 p-6 sm:p-10">
          <p className="eyebrow">{formatDropDate(today)}</p>
          <Guide guidance={guidance} id="drop-heading" as="h1" size="lg" />
          <p className="max-w-2xl text-ink-2">
            One photo for everyone, every day. Caption it, vote on the others, and the top caption wins when the day ends at midnight Eastern Time.
            {challenge.theme ? ` Today's theme: ${challenge.theme}.` : ""}
          </p>
        </div>
      </section>

      {setupMissing && (
        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
          The Daily Drop isn&apos;t set up in the database yet. An administrator needs to apply migration 004.
        </p>
      )}

      {!challenge.item ? (
        <EmptyState title="No challenge photo today" mood="confused">
          There&apos;s no photo to caption today. Check back tomorrow.
        </EmptyState>
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
        <div className="panel grid items-center gap-6 p-5 sm:grid-cols-[1fr_1fr] sm:p-8">
          <Photo src={libraryUrl(challenge.item.file)} alt={challenge.item.title} size="drop" loading="eager" scrim={false} />
          <div className="flex flex-col gap-4">
            <p className="text-ink-2">
              {entryCount ? `${entryCount} ${entryCount === 1 ? "caption" : "captions"} so far today. ` : "Be the first to caption it. "}
              Sign in to enter, vote and see the entries.
            </p>
            <Link href="/login?next=/drop" className="btn-primary btn-lg press self-start">
              Sign in to play
            </Link>
          </div>
        </div>
      )}

      {signedIn && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-labelledby="yesterday" className="flex flex-col gap-4">
            <div>
              <p className="eyebrow">Yesterday</p>
              <h2 id="yesterday" className="mt-1 text-2xl">
                Yesterday&apos;s winner
              </h2>
            </div>
            {winner ? (
              <WinnerCard imageUrl={winnerUrl} content={winner.content} author={winner.author_name} voice={winner.voice} score={Number(winner.score)} label="Winner" />
            ) : (
              <p className="panel px-5 py-8 text-center text-sm text-muted">
                No winner yesterday ({formatDropDate(yesterday)}). A winner needs at least one entry with a positive score.
              </p>
            )}
          </section>

          <section aria-labelledby="entries" className="flex flex-col gap-4">
            <div>
              <p className="eyebrow">Vote on the others</p>
              <h2 id="entries" className="mt-1 text-2xl">
                Today&apos;s entries {entryCount !== null && <span className="text-muted">({entryCount})</span>}
              </h2>
            </div>
            {entries.length > 0 ? (
              <DropEntries posts={entries} />
            ) : (
              <EmptyState title="No entries yet today">
                Yours could be the first. <Icon name="arrow" className="inline h-3.5 w-3.5" />
              </EmptyState>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
