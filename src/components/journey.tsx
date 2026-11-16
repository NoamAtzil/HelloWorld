import { Icon } from "./icons";
import { groupStages, type Stage } from "@/lib/stages";

type Props = {
  stages: Stage[];
  /** "static": a calm overview. "run": nodes show pending / running / done. */
  mode?: "static" | "run";
  /** Steps finished so far (run mode). */
  done?: number;
  /** Index of the step currently running, or -1 (run mode). */
  active?: number;
  /** Show the final caption node as complete (run mode, when finished). */
  complete?: boolean;
  compact?: boolean;
};

// Your photo -> Creative thinking -> Refined idea -> Final caption.
// A friendly overview of what a chain does, not a technical graph.
export function JourneyTrack({ stages, mode = "static", done = 0, active = -1, complete = false, compact = false }: Props) {
  const groups = groupStages(stages);
  const size = compact ? "h-9 w-9" : "h-12 w-12";
  const icon = compact ? "h-4 w-4" : "h-5 w-5";

  const nodes = [
    { key: "photo", label: "Your photo", icon: "photo" as const, count: 1, state: mode === "run" ? "done" : "ready" },
    ...groups.map((g) => {
      let state: string = "ready";
      if (mode === "run") {
        const isLast = g.stage.key === "caption";
        if (complete && isLast) state = "done";
        else if (done >= g.end) state = "done";
        else if (active >= g.start && active < g.end) state = "running";
        else state = "pending";
      }
      return { key: `${g.stage.key}-${g.start}`, label: g.stage.label, icon: g.stage.icon, count: g.end - g.start, state };
    }),
  ];

  if (stages.length === 0) {
    return <p className="text-sm text-muted">Add steps to see your photo become a caption.</p>;
  }

  return (
    <ol className="flex items-start" aria-label="The journey from photo to caption">
      {nodes.map((node, i) => (
        <li key={node.key} className="flex min-w-0 flex-1 items-start last:flex-none">
          <div className="flex w-[4.6rem] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[5.4rem]">
            <span
              data-state={node.state}
              className={`grid ${size} place-items-center rounded-full transition-all duration-500 ${
                node.state === "ready" || node.state === "done"
                  ? "bg-gradient-to-br from-[var(--btn-from)] to-accent text-on-accent shadow-[var(--shadow-glow)]"
                  : node.state === "running"
                    ? "bg-gradient-to-br from-[var(--btn-from)] to-accent text-on-accent shadow-[var(--shadow-glow)] ring-4 ring-glow/30"
                    : "bg-tint-2 text-muted"
              }`}
            >
              {node.state === "done" && mode === "run" ? <Icon name="check" className={icon} strokeWidth={2.4} /> : node.state === "running" ? <span className="spinner" /> : <Icon name={node.icon} className={icon} />}
            </span>
            <span className={`text-[0.7rem] font-semibold leading-tight ${node.state === "pending" ? "text-muted" : "text-ink"}`}>
              {node.label}
              {node.count > 1 && <span className="ml-1 font-normal text-muted">×{node.count}</span>}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <span className={`mt-[1.15rem] h-0.5 min-w-3 flex-1 overflow-hidden rounded-full bg-tint-2 ${compact ? "!mt-[1.05rem]" : ""}`} aria-hidden="true">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-glow to-amber transition-all duration-700"
                style={{ width: mode === "static" || nodes[i + 1].state === "done" || nodes[i + 1].state === "running" ? "100%" : "0%", opacity: mode === "static" ? 0.55 : 1 }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
