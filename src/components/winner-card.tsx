import { voiceLabel } from "@/lib/voices";

// A read-only caption: photo, frosted plate, and who/what made it.
export function WinnerCard({
  imageUrl,
  content,
  author,
  voice,
  score,
  label,
}: {
  imageUrl: string | null;
  content: string;
  author: string;
  voice: string | null;
  score?: number;
  label?: string;
}) {
  const voiceName = voiceLabel(voice);
  return (
    <figure>
      <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card ring-1 ring-black/5">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={content} loading="lazy" decoding="async" className="max-h-[26rem] w-full object-cover" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-sm text-muted">Photo unavailable</div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
        {label && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-accent">
            {label}
          </span>
        )}
      </div>
      <figcaption>
        <div className="bend-plate plate-glass relative z-[1] mx-3 -mt-10 px-5 pb-6 pt-4 pr-12">
          <p className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{content}</p>
        </div>
        <p className="mt-2 px-2 text-sm text-muted">
          <span className="font-semibold text-ink">{author}</span>
          {voiceName ? ` · ${voiceName}` : ""}
          {typeof score === "number" ? ` · score ${score > 0 ? `+${score}` : score}` : ""}
        </p>
      </figcaption>
    </figure>
  );
}
