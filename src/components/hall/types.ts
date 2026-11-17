// What the museum shows. Every field comes straight from a real leaderboard row
// (the RPC results, mapped on the server). Nothing here is invented.
export type ExhibitData = {
  id: number;
  content: string;
  imageUrl: string | null;
  author: string;
  voice: string | null;
  /** The big number, e.g. "+7" or "80%". */
  stat: string;
  /** What it means, e.g. "score" or "4/5 won". */
  statLabel: string;
  /** The placard: "No. 1", or the date for a Daily Drop winner. */
  noLabel: string;
};

export type CreatorData = {
  id: string;
  name: string;
  avatarUrl: string | null;
  posts: number;
  score: number;
};

export type GalleryKey = "captions" | "arena" | "winners";
