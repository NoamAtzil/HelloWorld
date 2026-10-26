import libraryJson from "@/lib/image-library.json";

// Generated from public/library/ by scripts/build-image-library.mjs.
export type LibraryItem = { file: string; title: string };

export const LIBRARY: LibraryItem[] = libraryJson;

export const libraryUrl = (file: string) => `/library/${encodeURIComponent(file)}`;

// A library image's "slug" is its file name. It is stored on posts so
// captions of the same photo can meet in the Arena.
export function findLibraryItem(slug: string | null | undefined) {
  return slug ? LIBRARY.find((item) => item.file === slug) ?? null : null;
}
