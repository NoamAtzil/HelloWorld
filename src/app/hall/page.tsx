import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Guide } from "@/components/guide";
import { SignInGate } from "@/components/sign-in-gate";
import { HALL_GUIDANCE } from "@/lib/guidance";
import { formatDropDate } from "@/lib/drop";
import { signImages } from "@/lib/posts";
import { voiceLabel } from "@/lib/voices";

export const metadata: Metadata = {
  title: "Hall of Fame — caption",
  description: "The best captions, Arena champions, and top creators.",
};

type Caption = { id: number; content: string; image_path: string; voice: string | null; author_name: string; score: number | string };
type ArenaRow = { id: number; content: string; image_path: string; voice: string | null; author_name: string; wins: number | string; battles: number | string };
type Creator = { user_id: string; author_name: string; avatar_url: string | null; posts: number | string; score: number | string };
type Winner = { drop_date: string; id: number; content: string; image_path: string; voice: string | null; author_name: string; score: number | string };

export default async function HallPage(props: PageProps<"/hall">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <SignInGate title="The Hall of Fame" next="/hall">
          See the top captions, Arena champions and Daily Drop winners. Sign in to browse them.
        </SignInGate>
      </main>
    );
  }

  const period = (await props.searchParams).period === "all" ? "all" : "week";
  const days = period === "week" ? 7 : 0;

  const [captions, arena, creators, winners] = await Promise.all([
    supabase.rpc("hall_top_captions", { p_days: days }),
    supabase.rpc("hall_arena", { p_days: days }),
    supabase.rpc("hall_creators", { p_days: days }),
    supabase.rpc("drop_winners", { p_limit: 7 }),
  ]);
  const setupMissing = !!(captions.error || arena.error || creators.error);
  if (setupMissing) console.error("Hall of Fame RPC failed (is migration 004 applied?):", captions.error ?? arena.error ?? creators.error);

  const topCaptions = (captions.data ?? []) as Caption[];
  const arenaRows = (arena.data ?? []) as ArenaRow[];
  const creatorRows = (creators.data ?? []) as Creator[];
  const winnerRows = (winners.data ?? []) as Winner[];

  const urls = await signImages(supabase, [
    ...topCaptions.map((r) => r.image_path),
    ...arenaRows.map((r) => r.image_path),
    ...winnerRows.map((r) => r.image_path),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <section className="stage" aria-labelledby="hall-heading">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-10">
          <div className="flex flex-col gap-3">
            <Guide guidance={HALL_GUIDANCE} id="hall-heading" as="h1" size="lg" />
            <p className="max-w-xl text-ink-2">Real votes, real results. Nothing here is made up.</p>
          </div>
          <div role="group" aria-label="Time period" className="liquid inline-flex rounded-full p-1">
            {([["week", "This week", "/hall"], ["all", "All time", "/hall?period=all"]] as const).map(([value, label, href]) => (
              <Link
                key={value}
                href={href}
                aria-current={period === value ? "true" : undefined}
                className={`relative z-[1] min-h-9 rounded-full px-4 py-2 text-sm transition-all ${period === value ? "bg-surface-solid font-semibold text-accent-text shadow-[var(--shadow-sm)]" : "font-medium text-muted hover:text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {setupMissing && (
        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
          The Hall of Fame isn&apos;t set up in the database yet. An administrator needs to apply migration 004.
        </p>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-2">
      <Section title="Top captions" count={topCaptions.length} empty="No captions have a positive score yet. Vote in the feed to get this started.">
        {topCaptions.map((c, i) => (
          <Row key={c.id} rank={i + 1} imageUrl={urls.get(c.image_path)} title={c.content} meta={`${c.author_name}${voiceLabel(c.voice) ? ` · ${voiceLabel(c.voice)}` : ""}`} stat={`+${Number(c.score)}`} statLabel="score" />
        ))}
      </Section>

      <Section title="Arena champions" count={arenaRows.length} empty="No caption has won enough battles yet. A caption needs at least 2 battles and a win. Play in the Arena!">
        {arenaRows.map((c, i) => (
          <Row key={c.id} rank={i + 1} imageUrl={urls.get(c.image_path)} title={c.content} meta={`${c.author_name}${voiceLabel(c.voice) ? ` · ${voiceLabel(c.voice)}` : ""}`} stat={`${Math.round((Number(c.wins) / Number(c.battles)) * 100)}%`} statLabel={`${c.wins}/${c.battles} won`} />
        ))}
      </Section>

      <Section title="Top creators" count={creatorRows.length} empty="No creator has a positive total score yet.">
        {creatorRows.map((c, i) => (
          <li key={c.user_id} className="flex items-center gap-3 rounded-2xl p-2">
            <Rank n={i + 1} />
            {c.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tint font-bold text-accent-text">
                {c.author_name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.author_name}</span>
              <span className="block text-xs text-muted">{Number(c.posts)} scored {Number(c.posts) === 1 ? "caption" : "captions"}</span>
            </span>
            <Stat value={`+${Number(c.score)}`} label="score" />
          </li>
        ))}
      </Section>

      <Section title="Daily Drop winners" count={winnerRows.length} empty="No Daily Drop has crowned a winner yet.">
        {winnerRows.map((w) => (
          <Row key={w.id} imageUrl={urls.get(w.image_path)} title={w.content} meta={`${w.author_name} · ${formatDropDate(w.drop_date)}`} stat={`+${Number(w.score)}`} statLabel="score" />
        ))}
      </Section>
      </div>
    </main>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  const hasItems = count > 0;
  return (
    <section aria-label={title} className="reveal flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      {hasItems ? (
        <ol className="panel flex flex-col gap-1 !rounded-3xl p-2">{children}</ol>
      ) : (
        <p className="panel px-5 py-8 text-center text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${n === 1 ? "bg-gradient-to-br from-[var(--btn-from)] to-accent text-on-accent shadow-[var(--shadow-glow)]" : "bg-tint text-accent-text"}`}>
      {n}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="shrink-0 text-right">
      <span className="block text-lg font-bold tabular-nums">{value}</span>
      <span className="block text-xs text-muted">{label}</span>
    </span>
  );
}

function Row({ rank, imageUrl, title, meta, stat, statLabel }: { rank?: number; imageUrl?: string | null; title: string; meta: string; stat: string; statLabel: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-tint/50">
      {rank !== undefined && <Rank n={rank} />}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="h-14 w-14 shrink-0 rounded-xl bg-tint-2" />
      )}
      <span className="min-w-0 flex-1">
        <span className="caption-text line-clamp-2 text-[1.02rem]">{title}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      <Stat value={stat} label={statLabel} />
    </li>
  );
}
