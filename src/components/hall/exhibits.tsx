import type { ExhibitData } from "./types";

function Exhibit({ item, feature, ribbon, onOpen }: { item: ExhibitData; feature: boolean; ribbon?: string; onOpen: (el: HTMLElement) => void }) {
  return (
    <li className={feature ? "feature col-span-2" : ""} style={feature ? { gridColumn: "span 2" } : undefined}>
      <button type="button" className={`exhibit ${feature ? "feature" : ""}`} onClick={(e) => onOpen(e.currentTarget)} aria-label={`Open exhibit ${item.noLabel}: ${item.content}, by ${item.author}, ${item.stat} ${item.statLabel}`}>
        <span className="ex-light" aria-hidden="true" />
        <span className="ex-frame">
          {ribbon && <span className="ex-ribbon">{ribbon}</span>}
          <span className="ex-mat">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="ex-blank" />
            )}
          </span>
        </span>
        <span className="ex-plaque">
          <span className="ex-no">{item.noLabel}</span>
          <span className="ex-title">{item.content}</span>
          <span className="ex-meta">
            <span>{item.author}</span>
            <span>
              <b>{item.stat}</b> {item.statLabel}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

// A wall of framed exhibits, straight from a real leaderboard. An empty leaderboard
// is an honest empty frame, never made-up filler.
export function Gallery({
  id,
  kicker,
  title,
  items,
  empty,
  featureFirst = false,
  firstRibbon,
  onOpen,
}: {
  id: string;
  kicker: string;
  title: string;
  items: ExhibitData[];
  empty: string;
  featureFirst?: boolean;
  firstRibbon?: string;
  onOpen: (index: number, el: HTMLElement) => void;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="reveal wall scroll-mt-24">
      <div className="wall-head">
        <div>
          <p className="eyebrow">{kicker}</p>
          <h2 id={`${id}-h`} className="mt-1">
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted">
          {items.length} {items.length === 1 ? "exhibit" : "exhibits"}
        </p>
      </div>
      {items.length > 0 ? (
        <ol className="exhibits">
          {items.map((item, i) => (
            <Exhibit key={`${item.id}-${i}`} item={item} feature={featureFirst && i === 0} ribbon={i === 0 ? firstRibbon : undefined} onOpen={(el) => onOpen(i, el)} />
          ))}
        </ol>
      ) : (
        <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--line)] px-6 py-12 text-center">
          <span aria-hidden="true" className="grid h-20 w-24 place-items-center rounded-md border-4 border-[var(--gold-2)] font-display text-3xl text-muted">
            ?
          </span>
          <p className="max-w-md text-sm text-muted">{empty}</p>
        </div>
      )}
    </section>
  );
}
