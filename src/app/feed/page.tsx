import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignInGate } from "@/components/sign-in-gate";
import { toFeedPost, signImages, type PostRow } from "@/lib/posts";
import { FeedClient } from "./feed-client";
import { parseSort } from "./sort";

export default async function FeedPage(props: PageProps<"/feed">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <SignInGate title="The feed is for members" next="/feed">
          See every caption, vote on what lands, and share your favorites.
        </SignInGate>
      </main>
    );
  }

  const initialSort = parseSort((await props.searchParams).sort);

  // One query returns every post with its total score and the caller's own
  // vote; ranking happens client-side from this real data. If the newer
  // function isn't installed yet, fall back to the original one.
  let { data, error } = await supabase.rpc("feed_posts");
  if (error) {
    ({ data, error } = await supabase.rpc("feed_generations"));
  }
  const rows = (data ?? []) as PostRow[];

  // RLS limits this select to the caller's own posts, so these are the ones
  // that get a delete button.
  const { data: mine } = await supabase.from("generations").select("id");
  const myIds = new Set((mine ?? []).map((row) => row.id as number));

  const urls = await signImages(supabase, rows.map((row) => row.image_path));
  const posts = rows.map((row) => toFeedPost(row, urls, myIds));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pb-24 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">The feed</h1>
          <p className="mt-1 text-sm text-muted">Every caption, scored by the community.</p>
        </div>
        <Link href="/studio" className="btn-primary press">
          Make a caption
        </Link>
      </div>
      <FeedClient posts={posts} initialSort={initialSort} loadFailed={!!error} />
    </main>
  );
}
