// Public URL of an image the author chose to share (bucket "shared-images").
export function sharedImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Never let a stored path climb out of the bucket.
  const parts = path.split("/").filter((part) => part !== "" && part !== "." && part !== "..");
  return `${base}/storage/v1/object/public/shared-images/${parts.map(encodeURIComponent).join("/")}`;
}
