import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Story } from "@/components/story";
import { Studio } from "@/components/studio";
import { dropDate, formatDropDate } from "@/lib/drop";
import { getChallenge } from "@/lib/drop-server";
import { libraryUrl } from "@/lib/library";
import { sharedImageUrl } from "@/lib/public-url";
import { voiceLabel } from "@/lib/voices";

type ShowcaseRow = {
  id: number;
  content: string;
  image_path: string;
  voice: string | null;
  author_name: string;
  score: number | string;
};

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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-24 px-4 pb-24 pt-8 sm:pt-14">
      <section className="relative grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <span aria-hidden="true" className="hero-orb -right-24 -top-20 h-96 w-96" />
        <div className="rise flex min-w-0 flex-col gap-6 lg:sticky lg:top-24 lg:pt-6">
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-glow/30 bg-tint px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-text">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-glow" />
            Photos in, punchlines out
          </p>
          <h1 className="text-5xl font-bold leading-[1.02] sm:text-6xl">
            Drop a photo.
            <br />
            <span className="text-accent-text">Get the joke.</span>
          </h1>
          <p className="max-w-md text-lg text-muted">
            Pick a voice, get three real AI captions in seconds, remix your favorite, then
            battle it out in the Arena.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="#studio" className="btn-primary press">
              Try it now
            </a>
            {signedIn ? (
              <Link href="/arena" className="btn-quiet press">
                Enter the Arena
              </Link>
            ) : (
              <Link href="/login" className="btn-quiet press">
                Sign in
              </Link>
            )}
          </div>
          <p className="text-sm text-muted">
            {signedIn
              ? "You're signed in: publish, remix, vote and compete."
              : "No account needed to generate. Sign in to publish, vote and save."}
          </p>
        </div>

        <div className="rise min-w-0" style={{ "--i": 2 } as React.CSSProperties}>
          <Studio signedIn={signedIn} />
        </div>
      </section>

      <Story />

      <section aria-labelledby="wall-title" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="wall-title" className="text-3xl font-bold sm:text-4xl">
              Fresh from the community
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted">
              Captions their authors chose to share with the world. Everything members publish
              stays members-only unless the author opts in.
            </p>
          </div>
          <Link href={signedIn ? "/feed" : "/login?next=/feed"} className="btn-quiet press">
            {signedIn ? "Open the feed" : "Sign in to see more"}
          </Link>
        </div>

        {wall.length > 0 ? (
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4">
            {wall.map((post, index) => (
              <li key={post.id} className="reveal w-[78%] shrink-0 snap-start sm:w-72" style={{ "--i": index } as React.CSSProperties}>
                <Link href={`/c/${post.id}`} className="lift group block">
                  <div className="overflow-hidden rounded-[20px] bg-tint-2 shadow-card ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sharedImageUrl(post.image_path)}
                      alt={post.content}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="bend-plate plate-glass relative z-[1] mx-2 -mt-8 px-4 pb-5 pt-3 pr-10">
                    <p className="line-clamp-3 text-base font-semibold leading-snug tracking-tight">{post.content}</p>
                  </div>
                  <p className="mt-2 px-2 text-xs text-muted">
                    {post.author_name}
                    {voiceLabel(post.voice) ? ` · ${voiceLabel(post.voice)}` : ""} · score {Number(post.score)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="glass flex flex-col items-start gap-3 rounded-3xl p-6">
            <p className="font-display text-xl font-bold">Nothing has been shared publicly yet.</p>
            <p className="max-w-md text-sm text-muted">
              When a member publishes a caption and ticks &ldquo;Also share publicly&rdquo;, it
              appears here. You could be the first.
            </p>
            <a href="#studio" className="btn-primary press">Make a caption</a>
          </div>
        )}
      </section>

      <section aria-labelledby="drop-title" className="glass glass-lit reveal grid items-center gap-6 overflow-hidden rounded-[32px] p-5 sm:grid-cols-[1fr_1.1fr] sm:p-8">
        {challenge.item && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={libraryUrl(challenge.item.file)}
            alt={challenge.item.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full rounded-[22px] object-cover ring-1 ring-black/5"
          />
        )}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-accent-text">{formatDropDate(challenge.date)}</p>
          <h2 id="drop-title" className="text-3xl font-bold sm:text-4xl">
            Today&apos;s Daily Drop
          </h2>
          <p className="text-muted">
            One photo for everyone. Caption it, vote on the others, and the top caption is crowned
            when the day ends.
            {entries !== null && entries > 0
              ? ` ${entries} ${entries === 1 ? "caption is" : "captions are"} in so far.`
              : " No captions yet. Be the first."}
          </p>
          <Link href="/drop" className="btn-primary press self-start">
            {signedIn ? "Enter today's Drop" : "See today's Drop"}
          </Link>
        </div>
      </section>

      {!signedIn && (
        <section className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to publish?</h2>
          <p className="max-w-md text-muted">
            A free Google account unlocks publishing, remixing, the Arena, the Daily Drop and your
            own caption history.
          </p>
          <Link href="/login" className="btn-primary press">
            Sign in with Google
          </Link>
        </section>
      )}
    </main>
  );
}
