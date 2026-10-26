import { Photo } from "@/components/photo";
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
      <Photo src={imageUrl} alt={content} size="feed">
        {label && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-accent">
            {label}
          </span>
        )}
      </Photo>
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
