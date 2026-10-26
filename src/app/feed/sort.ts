export type FeedSort = "recent" | "top";

export type FeedPost = {
  id: number;
  content: string;
  direction: string | null;
  imageUrl: string | null;
  createdAt: string;
  score: number;
  myVote: number | null;
  mine: boolean;
  voice: string | null;
  isPublic: boolean;
  dropDate: string | null;
  author: string | null;
};

export function parseSort(value: string | string[] | undefined): FeedSort {
  return value === "top" ? "top" : "recent";
}

// Recent: newest first. Top: highest net score first, newest first on ties
// (negative scores sort below zero naturally). `id` breaks exact timestamp
// ties so the order is always deterministic.
export function sortPosts(posts: FeedPost[], sort: FeedSort): FeedPost[] {
  const byNewest = (a: FeedPost, b: FeedPost) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
  return [...posts].sort(
    sort === "top"
      ? (a, b) => b.score - a.score || byNewest(a, b)
      : byNewest,
  );
}

// Mirrors the server rule for instant feedback only (the database stays the
// source of truth): same arrow again clears the vote, the other arrow
// switches it, otherwise it adds one.
export function applyVote(post: FeedPost, value: 1 | -1): FeedPost {
  const previous = post.myVote ?? 0;
  const next = previous === value ? 0 : value;
  return {
    ...post,
    score: post.score + (next - previous),
    myVote: next === 0 ? null : next,
  };
}
