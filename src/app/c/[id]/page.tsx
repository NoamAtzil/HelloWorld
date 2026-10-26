import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WinnerCard } from "@/components/winner-card";
import { sharedImageUrl } from "@/lib/public-url";

type PublicPost = {
  id: number;
  content: string;
  image_path: string;
  voice: string | null;
  author_name: string;
  score: number | string;
};

async function load(idParam: string): Promise<PublicPost | null> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_post", { p_id: id });
  return ((data ?? []) as PublicPost[])[0] ?? null;
}

export async function generateMetadata(props: PageProps<"/c/[id]">): Promise<Metadata> {
  const post = await load((await props.params).id);
  if (!post) return { title: "Caption not found" };
  return {
    title: `“${post.content}” — caption`,
    description: `A caption by ${post.author_name}.`,
    openGraph: { title: post.content, description: `A caption by ${post.author_name}.`, type: "article" },
    twitter: { card: "summary_large_image", title: post.content },
  };
}

// A single caption the author chose to share publicly. Nothing else about the
// author or any other post is exposed here.
export default async function PublicCaptionPage(props: PageProps<"/c/[id]">) {
  const post = await load((await props.params).id);
  if (!post) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-24 pt-8">
      <WinnerCard
        imageUrl={sharedImageUrl(post.image_path)}
        content={post.content}
        author={post.author_name}
        voice={post.voice}
        score={Number(post.score)}
      />
      <div className="glass flex flex-col gap-3 rounded-3xl p-5">
        <p className="font-display text-lg font-bold">Make your own.</p>
        <p className="text-sm text-muted">Pick a photo and a voice, get three captions, and publish your favorite.</p>
        <Link href="/" className="btn-primary press self-start">Try the Studio</Link>
      </div>
    </main>
  );
}
