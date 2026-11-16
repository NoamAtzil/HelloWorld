import { Photo } from "@/components/photo";
import { voiceLabel } from "@/lib/voices";

// A read-only caption: photo, straight serif plate, and who/what made it.
// A labelled card (a winner) gets the glowing Prompt Chains result-card border.
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
    <figure className={`${label ? "result-card" : "panel"} overflow-hidden !rounded-[1.6rem]`}>
      <Photo src={imageUrl} alt={content} size="feed" className="!rounded-none !shadow-none">
        {label && (
          <span className="absolute left-3 top-3 rounded-full bg-gradient-to-b from-[var(--btn-from)] to-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-accent shadow-[var(--shadow-glow)]">
            {label}
          </span>
        )}
      </Photo>
      <figcaption className="pb-4">
        <div className="plate-glass relative z-[1] mx-3 -mt-10 px-5 pb-5 pt-4">
          <p className="caption-text text-[1.35rem] sm:text-2xl">{content}</p>
        </div>
        <p className="mt-3 px-5 text-sm text-muted">
          <span className="font-semibold text-ink">{author}</span>
          {voiceName ? ` · ${voiceName}` : ""}
          {typeof score === "number" ? ` · score ${score > 0 ? `+${score}` : score}` : ""}
        </p>
      </figcaption>
    </figure>
  );
}
