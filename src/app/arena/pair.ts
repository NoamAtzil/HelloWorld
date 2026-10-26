import type { SupabaseClient } from "@supabase/supabase-js";
import { signImages } from "@/lib/posts";

export type ArenaSide = {
  id: number;
  content: string;
  imageUrl: string | null;
  voice: string | null;
};

export type ArenaPair = { sameImage: boolean; left: ArenaSide; right: ArenaSide };

type Row = {
  side: number;
  id: number;
  content: string;
  image_path: string;
  voice: string | null;
  same_image: boolean;
};

export type ArenaReveal = {
  pair_total: number;
  pair_winner_votes: number;
  winner: { id: number; voice: string | null; author: string; wins: number; battles: number };
  loser: { id: number; voice: string | null; author: string; wins: number; battles: number };
};

export async function loadArenaPair(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("arena_next_pair");
  if (error) return { pair: null, error };
  const rows = ((data ?? []) as Row[]).sort((a, b) => a.side - b.side);
  if (rows.length < 2) return { pair: null as ArenaPair | null, error: null };
  const urls = await signImages(supabase, rows.map((r) => r.image_path));
  const side = (r: Row): ArenaSide => ({
    id: r.id,
    content: r.content,
    imageUrl: urls.get(r.image_path) ?? null,
    voice: r.voice,
  });
  return {
    pair: { sameImage: rows[0].same_image, left: side(rows[0]), right: side(rows[1]) } as ArenaPair,
    error: null,
  };
}
