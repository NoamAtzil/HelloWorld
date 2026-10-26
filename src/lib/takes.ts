// Pure helpers for turning model output into captions (kept free of the SDK
// so they can be unit-tested).

export const MAX_CAPTION_LENGTH = 300;

function clean(text: unknown): string {
  return String(text ?? "")
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_CAPTION_LENGTH)
    .trim();
}

// Accepts {"captions": [...]} (what we ask for), a bare array, or fenced JSON.
// Returns up to `count` distinct, non-empty captions.
export function parseTakes(raw: string | undefined | null, count = 3): string[] {
  if (!raw) return [];
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { captions?: unknown }).captions)
      ? (data as { captions: unknown[] }).captions
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const caption = clean(item);
    const key = caption.toLowerCase();
    if (caption && !seen.has(key)) {
      seen.add(key);
      out.push(caption);
    }
    if (out.length === count) break;
  }
  return out;
}

export function parseSingle(raw: string | undefined | null): string {
  return clean((raw ?? "").split("\n").find((line) => line.trim()) ?? "");
}
