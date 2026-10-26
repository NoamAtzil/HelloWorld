import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedPost } from "@/app/feed/sort";

// Posts whose instruction is the generic default aren't worth showing.
const GENERIC_INSTRUCTION = /^write a (funny )?caption for this photo\.?$/i;

export async function signImages(supabase: SupabaseClient, paths: string[]) {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data } = await supabase.storage.from("post-images").createSignedUrls(paths, 60 * 60);
  for (const s of data ?? []) {
    if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return urls;
}

export type PostRow = {
  id: number;
  prompt?: string;
  content: string;
  image_path: string;
  created_at: string;
  score: number | string;
  my_vote?: number | null;
  voice?: string | null;
  is_public?: boolean;
  drop_date?: string | null;
  author_name?: string | null;
  mine?: boolean;
};

export function toFeedPost(
  row: PostRow,
  urls: Map<string, string>,
  mineIds?: Set<number>,
): FeedPost {
  const prompt = row.prompt?.trim() ?? "";
  return {
    id: row.id,
    content: row.content,
    direction: prompt && !GENERIC_INSTRUCTION.test(prompt) ? prompt : null,
    imageUrl: urls.get(row.image_path) ?? null,
    createdAt: row.created_at,
    score: Number(row.score),
    myVote: row.my_vote ?? null,
    mine: row.mine ?? mineIds?.has(row.id) ?? false,
    voice: row.voice ?? null,
    isPublic: row.is_public ?? false,
    dropDate: row.drop_date ?? null,
    author: row.author_name ?? null,
  };
}
