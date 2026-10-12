import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedClient } from "./feed-client";
import { parseSort, type FeedPost } from "./sort";

type FeedRow = {
  id: number;
  prompt: string;
  content: string;
  image_path: string;
  created_at: string;
  score: number;
  my_vote: number | null;
};

// Posts made without a custom direction store a generic default instruction;
// it isn't worth showing under every such post.
const GENERIC_INSTRUCTION = /^write a (funny )?caption for this photo\.?$/i;

export default async function FeedPage(props: PageProps<"/feed">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    redirect("/login");
  }

  const initialSort = parseSort((await props.searchParams).sort);

  // One query returns every post with its total score and the caller's own
  // vote; ranking happens client-side from this real data, so switching sort
  // needs no extra round trip.
  const { data, error } = await supabase.rpc("feed_generations");
  const rows = (data ?? []) as FeedRow[];

  // RLS limits this select to the caller's own posts, so these are the ones
  // that get a delete button.
  const { data: mine } = await supabase.from("generations").select("id");
  const myIds = new Set((mine ?? []).map((row) => row.id as number));

  // The bucket is private: sign one short-lived URL per image, in one call.
  const { data: signed } = await supabase.storage
    .from("post-images")
    .createSignedUrls(
      rows.map((row) => row.image_path),
      60 * 60,
    );
  const imageUrls = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  );

  const posts: FeedPost[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    direction: GENERIC_INSTRUCTION.test(row.prompt.trim()) ? null : row.prompt,
    imageUrl: imageUrls.get(row.image_path) ?? null,
    createdAt: row.created_at,
    score: Number(row.score),
    myVote: row.my_vote,
    mine: myIds.has(row.id),
  }));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pb-24 pt-6">
      <h1 className="sr-only">Feed</h1>
      <FeedClient
        posts={posts}
        initialSort={initialSort}
        loadFailed={!!error}
      />
    </main>
  );
}
