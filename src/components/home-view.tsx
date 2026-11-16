import Link from "next/link";
import { FlowTrack } from "@/components/flow-track";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { StoryScene } from "@/components/story-scene";
import { Studio } from "@/components/studio";
import { EmptyState } from "@/components/ui";
import { formatDropDate } from "@/lib/drop";
import { dropGuidance } from "@/lib/guidance";
import { LIBRARY, libraryUrl, type LibraryItem } from "@/lib/library";
import { sharedImageUrl } from "@/lib/public-url";
import { VOICES, voiceLabel } from "@/lib/voices";

export type ShowcaseRow = {
  id: number;
  content: string;
  image_path: string;
  voice: string | null;
  author_name: string;
  score: number | string;
};

export type HomeViewProps = {
  signedIn: boolean;
  wall: ShowcaseRow[];
  challenge: { date: string; item: LibraryItem | null };
  entries: number | null;
};

// Sample captions for the hero story, matched to the library photos. They are
// brand copy (like the old homepage's samples), not AI output.
const HERO_CAPTIONS: Record<string, string> = {
  "01-finals-meltdown-in-the-library.jpg": "Day 4 of “just five more minutes” with Aristotle.",
  "02-assignment-submitted-at-the-buzzer.jpg": "Submitted at 11:59:58. Dignity at 11:59:59.",
  "03-chasing-the-1-train.jpg": "The 1 train: the only thing on campus that runs on its own schedule.",
  "04-carrying-coffee-across-campus.jpg": "Carrying three coffees and a dream. Mostly the coffees.",
  "05-studying-through-the-party.jpg": "Studying through the party: a love story with no ending.",
  "06-napping-in-the-library.jpg": "Not sleeping, just buffering.",
};

const FLOW = [
  { key: "photo", label: "Your photo", icon: "photo", text: "Upload one, or pick from the library. We never bend it." },
  { key: "takes", label: "Three takes", icon: "spark", text: "Pick a voice and get three AI captions. Remix until it lands." },
  { key: "publish", label: "Publish", icon: "quote", text: "Share with members, or opt in to share with the world." },
  { key: "arena", label: "The Arena", icon: "duel", text: "Two captions, one photo. The crowd picks the funnier one." },
] as const;

// Presentational: the page (or a preview harness) supplies the data.
export function HomeView({ signedIn, wall, challenge, entries }: HomeViewProps) {
  const slots = LIBRARY.filter((item) => HERO_CAPTIONS[item.file]).map((item) => ({ imageUrl: libraryUrl(item.file), caption: HERO_CAPTIONS[item.file] }));
  const facts = [
    { n: VOICES.length, l: "voices" },
    { n: 3, l: "takes per photo" },
    { n: LIBRARY.length, l: "library photos" },
    ...(entries !== null ? [{ n: entries, l: entries === 1 ? "Drop entry today" : "Drop entries today" }] : []),
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 py-8 sm:px-6 sm:py-12">
      {/* HERO: the Prompt Chains stage, with the Caption Creature's story */}
      <section className="stage" aria-labelledby="hero-title">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-4 p-6 sm:p-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-6 lg:p-12 lg:pr-8">
          <div className="relative z-10 flex flex-col items-start gap-6">
            <p className="eyebrow liquid inline-flex items-center gap-2 rounded-full px-3.5 py-1.5">
              <Icon name="spark" className="h-3.5 w-3.5" /> Photos in, punchlines out
            </p>
            <h1 id="hero-title" className="text-balance text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-[4rem]">
              Drop a photo. <em className="font-semibold italic text-accent-text">Get the joke.</em>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-2">
              Pick a voice, get three real AI captions in seconds, remix your favorite, then battle it out in the Arena.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#studio" className="btn-primary btn-lg press">
                <Icon name="spark" className="h-[1.1rem] w-[1.1rem]" /> Try it now
              </a>
              {signedIn ? (
                <Link href="/arena" className="btn-quiet btn-lg press">
                  <Icon name="duel" className="h-[1.1rem] w-[1.1rem]" /> Enter the Arena
                </Link>
              ) : (
                <Link href="/login" className="btn-quiet btn-lg press">
                  Sign in
                </Link>
              )}
            </div>
            {/* The creature introduces itself and points at the first step. */}
            <p className="liquid liquid-strong flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-snug text-ink-2">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tint text-accent-text">
                <Icon name="quote" className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong className="text-ink">Hi, I&apos;m the Caption Creature.</strong>{" "}
                {signedIn ? "Pick a photo below and I'll write three takes for you." : "No account needed. Pick a photo below and I'll write three takes for you."}
              </span>
            </p>
            <dl className="flex flex-wrap gap-x-7 gap-y-2">
              {facts.map((f) => (
                <div key={f.l} className="flex flex-row-reverse items-baseline justify-end gap-2">
                  <dt className="text-sm text-muted">{f.l}</dt>
                  <dd className="display text-3xl tabular-nums">{f.n}</dd>
                </div>
              ))}
            </dl>
          </div>
          <StoryScene slots={slots} />
        </div>
      </section>

      {/* THE STUDIO */}
      <Studio signedIn={signedIn} heading="Try it right here" />

      {/* JOURNEY: how a photo becomes a winner */}
      <section aria-labelledby="journey-title" className="reveal flex flex-col gap-6">
        <div>
          <p className="eyebrow">How it works</p>
          <h2 id="journey-title" className="mt-1 text-3xl sm:text-4xl">
            From photo to punchline to <em className="font-semibold italic text-accent-text">winner.</em>
          </h2>
        </div>
        <div className="liquid rounded-3xl px-4 py-7 sm:px-10">
          <FlowTrack nodes={FLOW.map((n) => ({ ...n }))} />
        </div>
      </section>

      {/* THE COMMUNITY WALL */}
      <section aria-labelledby="wall-title" className="reveal flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Shared by the community</p>
            <h2 id="wall-title" className="mt-1 text-3xl sm:text-4xl">
              Fresh from the community
            </h2>
            <p className="mt-1 max-w-lg text-sm text-muted">
              Captions their authors chose to share with the world. Everything members publish stays members-only unless the author opts in.
            </p>
          </div>
          <Link href={signedIn ? "/feed" : "/login?next=/feed"} className="btn-quiet press">
            {signedIn ? "Open the feed" : "Sign in to see more"}
          </Link>
        </div>

        {wall.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {wall.map((post, index) => (
              <li key={post.id} className="rise" style={{ "--i": index } as React.CSSProperties}>
                <Link href={`/c/${post.id}`} className="panel lift group block overflow-hidden !rounded-[1.5rem]">
                  <Photo src={sharedImageUrl(post.image_path)} alt={post.content} size="thumb" scrim={false} className="!rounded-none !shadow-none" />
                  <div className="liquid liquid-strong relative z-[1] mx-3 -mt-10 mb-3 rounded-2xl p-4">
                    <p className="caption-text line-clamp-3 text-[1.1rem]">{post.content}</p>
                    <p className="mt-2 text-xs text-muted">
                      {post.author_name}
                      {voiceLabel(post.voice) ? ` · ${voiceLabel(post.voice)}` : ""} · score {Number(post.score)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing has been shared publicly yet"
            action={
              <a href="#studio" className="btn-primary press">
                Make a caption
              </a>
            }
          >
            When a member publishes a caption and ticks &ldquo;Also share publicly&rdquo;, it appears here. You could be the first.
          </EmptyState>
        )}
      </section>

      {/* TODAY'S DAILY DROP */}
      <section aria-labelledby="drop-title" className="stage reveal">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative grid items-center gap-8 p-6 sm:grid-cols-[1fr_1.1fr] sm:p-10">
          {challenge.item && <Photo src={libraryUrl(challenge.item.file)} alt={challenge.item.title} size="drop" scrim={false} />}
          <div className="flex flex-col gap-4">
            <p className="eyebrow">{formatDropDate(challenge.date)}</p>
            <h2 id="drop-title" className="text-3xl sm:text-4xl">
              Today&apos;s Daily Drop
            </h2>
            <Guide guidance={dropGuidance({ signedIn, hasChallenge: Boolean(challenge.item), alreadyEntered: false, entries })} size="sm" as="h3" />
            <p className="text-ink-2">
              One photo for everyone. Caption it, vote on the others, and the top caption is crowned when the day ends.
              {entries !== null && entries > 0 ? ` ${entries} ${entries === 1 ? "caption is" : "captions are"} in so far.` : " No captions yet. Be the first."}
            </p>
            <Link href="/drop" className="btn-primary press self-start">
              {signedIn ? "Enter today's Drop" : "See today's Drop"}
            </Link>
          </div>
        </div>
      </section>

      {!signedIn && (
        <section className="panel reveal flex flex-col items-center gap-4 p-8 text-center">
          <Guide guidance={{ mood: "curious", title: "Ready to publish?", line: "A free Google account unlocks it all." }} as="h2" size="lg" className="flex-col sm:flex-row sm:text-left" />
          <p className="max-w-md text-ink-2">Publishing, remixing, the Arena, the Daily Drop and your own caption history all need a free Google account.</p>
          <Link href="/login" className="btn-primary btn-lg press">
            Sign in with Google
          </Link>
        </section>
      )}
    </main>
  );
}
