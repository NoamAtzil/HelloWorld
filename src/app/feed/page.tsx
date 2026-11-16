import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
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
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Community"
        title="The feed"
        description="Every caption, scored by the community."
        actions={
          <Link href="/studio" className="btn-primary press">
            <Icon name="spark" /> Make a caption
          </Link>
        }
      />
      <FeedClient posts={posts} initialSort={initialSort} loadFailed={!!error} />
    </main>
  );
}
