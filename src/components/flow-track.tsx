import { Icon, type IconName } from "./icons";

export type FlowNode = { key: string; label: string; icon: IconName; text?: string };

// The journey strip from Prompt Chains' builder (same nodes, connectors and
// glow), generalised so the consumer app can show its own path:
// photo -> three takes -> publish -> Arena.
export function FlowTrack({ nodes, className = "" }: { nodes: FlowNode[]; className?: string }) {
  return (
    <ol className={`flex items-start ${className}`} aria-label="How it works">
      {nodes.map((node, i) => (
        <li key={node.key} className="flex min-w-0 flex-1 items-start last:flex-none">
          <div className="flex w-[5.4rem] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[7.5rem]">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[var(--btn-from)] to-accent text-on-accent shadow-[var(--shadow-glow)]">
              <Icon name={node.icon} className="h-5 w-5" />
            </span>
            <span className="text-[0.75rem] font-semibold leading-tight">{node.label}</span>
            {node.text && <span className="hidden text-xs leading-snug text-muted sm:block">{node.text}</span>}
          </div>
          {i < nodes.length - 1 && (
            <span className="mt-[1.15rem] h-0.5 min-w-3 flex-1 overflow-hidden rounded-full bg-tint-2" aria-hidden="true">
              <span className="block h-full w-full rounded-full bg-gradient-to-r from-glow to-amber opacity-60" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
