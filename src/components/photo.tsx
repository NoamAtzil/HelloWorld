// The one place a content photo is framed. Every page uses this, so photo sizing
// is decided here (and in the ".photo-*" rules in globals.css), not per page.
//
// Rules: the whole photo is always visible (object-fit: contain, never cropped,
// never stretched); its height is capped by the size preset and by the viewport,
// so a photo can never take over the screen; on a narrow screen it can never be
// wider than the screen. The frame is warm tint where the photo doesn't fill it.
//
//   studio  400px   the Studio preview
//   drop    350px   the Daily Drop challenge photo
//   arena   320px   the Arena photo(s)
//   feed    380px   feed, My captions, winner cards, public caption pages
//   thumb   4:3     small fixed cards (community wall, teaser)
export type PhotoSize = "studio" | "drop" | "arena" | "feed" | "thumb";

export function Photo({
  src,
  alt,
  size,
  fixed = false,
  loading = "lazy",
  scrim = true,
  backdrop,
  fallback = "Photo unavailable",
  className = "",
  imgClassName = "",
  children,
}: {
  src: string | null | undefined;
  alt: string;
  size: PhotoSize;
  /** Keep the frame the same height whatever the photo's shape (no layout jumps). */
  fixed?: boolean;
  loading?: "lazy" | "eager";
  /** Soft dark fade at the bottom, where the caption plate overlaps. */
  scrim?: boolean;
  /** Fill the side bars with a soft blurred copy of the photo. Default: on for the big photos only. */
  backdrop?: boolean;
  fallback?: string;
  className?: string;
  imgClassName?: string;
  /** Overlays (buttons, labels) positioned inside the frame. */
  children?: React.ReactNode;
}) {
  const withBackdrop = Boolean(src) && (backdrop ?? (size === "studio" || size === "drop" || size === "arena"));
  const style = withBackdrop
    ? ({ "--photo-src": `url("${String(src).replace(/["\\()\s]/g, (c) => encodeURIComponent(c))}")` } as React.CSSProperties)
    : undefined;
  return (
    <div
      style={style}
      className={`photo-frame photo-${size} ${fixed ? "photo-fixed" : ""} ${withBackdrop ? "photo-backdrop" : ""} ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className={`photo-img ${imgClassName}`}
        />
      ) : (
        <div className="photo-empty">{fallback}</div>
      )}
      {scrim && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
        />
      )}
      {children}
    </div>
  );
}
