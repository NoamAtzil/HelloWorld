import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { Studio } from "@/components/studio";
import { DropShow } from "@/components/drop/drop-show";
import { WinnerReveal, type Winner } from "@/components/drop/winner-reveal";
import { DROP_INTRO_KEY, DROP_WINNER_KEY, dropDate, formatDropDate, shiftDate } from "@/lib/drop";
import { getChallenge } from "@/lib/drop-server";
import { libraryUrl } from "@/lib/library";
import { signImages, toFeedPost, type PostRow } from "@/lib/posts";
import { DropEntries } from "./drop-entries";

export const metadata: Metadata = {
  title: "Daily Drop",
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
  const photoUrl = challenge.item ? libraryUrl(challenge.item.file) : null;

  const winnerView: Winner | null = winner
    ? { key: `${winner.drop_date}:${winner.id}`, content: winner.content, imageUrl: winnerUrl, author: winner.author_name, voice: winner.voice, score: Number(winner.score) }
    : null;

  // Runs before first paint on a hard load: if the curtain / the winner reveal should
  // play, close them now so there is no flash. (Client-side navigation is handled in
  // the components themselves.) Reduced motion never plays them.
  const prepaint = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var h=document.documentElement,l=localStorage;${
    challenge.item ? `if(l.getItem(${JSON.stringify(DROP_INTRO_KEY)})!==${JSON.stringify(today)})h.setAttribute("data-drop-intro","closed");` : ""
  }${signedIn && winnerView ? `if(l.getItem(${JSON.stringify(DROP_WINNER_KEY)})!==${JSON.stringify(winnerView.key)})h.setAttribute("data-drop-winner","closed");` : ""}}catch(e){}})()`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <script dangerouslySetInnerHTML={{ __html: prepaint }} />

      <DropShow
        dateLabel={formatDropDate(today)}
        today={today}
        challenge={challenge.item && photoUrl ? { title: challenge.item.title, theme: challenge.theme, photoUrl } : null}
        signedIn={signedIn}
        alreadyEntered={alreadyEntered}
        entryCount={entryCount}
      />

      {setupMissing && (
        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
          The Daily Drop isn&apos;t set up in the database yet. An administrator needs to apply migration 004.
        </p>
      )}

      {challenge.item && signedIn && (
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
      )}

      {challenge.item && !signedIn && (
        <div className="panel flex flex-col items-start gap-3 p-5 sm:p-7">
          <p className="text-ink-2">
            {entryCount ? `${entryCount} ${entryCount === 1 ? "caption" : "captions"} so far tonight. ` : "Nobody has entered yet. Be the first. "}
            Sign in to enter, judge and see the entries.
          </p>
          <Link href="/login?next=/drop" className="btn-primary press">
            Sign in to play
          </Link>
        </div>
      )}

      {signedIn && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <WinnerReveal winner={winnerView} dateLabel={formatDropDate(yesterday)} />

          <section id="entries" aria-labelledby="entries-heading" className="flex scroll-mt-24 flex-col gap-4">
            <div>
              <p className="eyebrow">The judging round</p>
              <h2 id="entries-heading" className="mt-1 text-2xl">
                Tonight&apos;s entries {entryCount !== null && <span className="text-muted">({entryCount})</span>}
              </h2>
            </div>
            {entries.length > 0 ? (
              <DropEntries posts={entries} />
            ) : (
              <EmptyState title="No entries yet tonight">
                Yours could be the first. <Icon name="arrow" className="inline h-3.5 w-3.5" />
              </EmptyState>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
