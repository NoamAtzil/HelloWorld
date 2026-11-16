import { Creature } from "./creature";
import type { Guidance } from "@/lib/guidance";

// The Caption Creature's guidance block, exactly as in Prompt Chains' live
// preview header: the creature beside an eyebrow, a title, and a status pill
// that changes with its mood. The line is an aria-live status so screen readers
// hear it change. It sits beside content and never covers controls.
export function Guide({
  guidance,
  eyebrow,
  size = "md",
  as: Heading = "h2",
  id,
  className = "",
  children,
}: {
  guidance: Guidance;
  eyebrow?: string;
  size?: "sm" | "md" | "lg";
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
  /** Extra content under the status pill (e.g. a primary action). */
  children?: React.ReactNode;
}) {
  const width = size === "lg" ? "w-28 sm:w-32" : size === "sm" ? "w-16" : "w-[5.2rem] sm:w-24";
  const titleSize = size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className={`${width} shrink-0`}>
        <Creature mood={guidance.mood} />
      </div>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading id={id} className={`mt-0.5 leading-tight ${titleSize}`}>
          {guidance.title}
        </Heading>
        <p className="mt-2 inline-block rounded-full bg-tint px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line" aria-live="polite">
          {guidance.line}
        </p>
        {children}
      </div>
    </div>
  );
}
