import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SignInGate } from "@/components/sign-in-gate";
import { HallOfFame, type HallData } from "@/components/hall/hall-of-fame";
import type { ExhibitData } from "@/components/hall/types";
import { formatDropDate } from "@/lib/drop";
import { signImages } from "@/lib/posts";
import { voiceLabel } from "@/lib/voices";

export const metadata: Metadata = {
  title: "Hall of Fame",
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

  const toExhibit = (
    r: { id: number; content: string; image_path: string; voice: string | null; author_name: string },
    stat: string,
    statLabel: string,
    noLabel: string,
  ): ExhibitData => ({
    id: r.id,
    content: r.content,
    imageUrl: urls.get(r.image_path) ?? null,
    author: r.author_name,
    voice: voiceLabel(r.voice) || null,
    stat,
    statLabel,
    noLabel,
  });

  const data: HallData = {
    period,
    captions: topCaptions.map((c, i) => toExhibit(c, `+${Number(c.score)}`, "score", `No. ${i + 1}`)),
    arena: arenaRows.map((c, i) =>
      toExhibit(c, `${Math.round((Number(c.wins) / Number(c.battles)) * 100)}%`, `${c.wins}/${c.battles} won`, `No. ${i + 1}`),
    ),
    winners: winnerRows.map((w) => toExhibit(w, `+${Number(w.score)}`, "score", formatDropDate(w.drop_date))),
    creators: creatorRows.map((c) => ({ id: c.user_id, name: c.author_name, avatarUrl: c.avatar_url, posts: Number(c.posts), score: Number(c.score) })),
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      {setupMissing && (
        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
          The Hall of Fame isn&apos;t set up in the database yet. An administrator needs to apply migration 004.
        </p>
      )}
      <HallOfFame data={data} />
    </main>
  );
}
