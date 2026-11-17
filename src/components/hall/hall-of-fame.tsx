"use client";

import { useRef, useState } from "react";
import { hallGuidance } from "@/lib/guidance";
import { getAudio } from "@/lib/sound/engine";
import { useSound } from "@/lib/sound/use-sound";
import { ExhibitViewer } from "./exhibit-viewer";
import { Gallery } from "./exhibits";
import { GrandHall } from "./grand-hall";
import { Podium } from "./podium";
import type { CreatorData, ExhibitData, GalleryKey } from "./types";

const NAMES: Record<GalleryKey, string> = {
  captions: "Gallery I · The Feed's Favorites",
  arena: "Gallery II · Arena Champions",
  winners: "The Winners' Wing",
};

export type HallData = {
  period: "week" | "all";
  captions: ExhibitData[];
  arena: ExhibitData[];
  winners: ExhibitData[];
  creators: CreatorData[];
};

// The Hall of Fame as the Museum of Legendary Comedy. Everything shown is a real
// leaderboard row; the eligibility rules (positive scores, at least 2 battles and a
// win in the Arena) are enforced by the database functions exactly as before.
export function HallOfFame({ data }: { data: HallData }) {
  const audio = getAudio();
  const sound = useSound("hall");
  const [viewer, setViewer] = useState<{ gallery: GalleryKey; index: number; masterpiece: boolean } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const items = (g: GalleryKey) => data[g];
  const current = viewer ? items(viewer.gallery)[viewer.index] : null;
  const guidance = hallGuidance({
    captions: data.captions.length + data.arena.length,
    creators: data.creators.length,
    doing: viewer ? (viewer.masterpiece ? "masterpiece" : "viewing") : "idle",
    creator: current?.author,
  });

  function open(gallery: GalleryKey, index: number, el: HTMLElement) {
    trigger.current = el;
    // Only the highest-ranked caption gets the masterpiece reveal.
    const masterpiece = gallery === "captions" && index === 0;
    audio.play("h_tap");
    setViewer({ gallery, index, masterpiece });
  }

  function close() {
    setViewer(null);
    window.setTimeout(() => trigger.current?.focus(), 30);
  }

  const periodLabel = data.period === "week" ? "this week" : "overall";

  return (
    <>
      <GrandHall guidance={guidance} period={data.period} sound={sound} onReact={() => audio.play("h_pip", { gain: 0.6 })} />

      <Podium creators={data.creators.slice(0, 3)} periodLabel={periodLabel} />

      {data.creators.length > 3 && (
        <section className="reveal" aria-label="More top creators">
          <p className="eyebrow mb-2 px-1">Honorable mentions</p>
          <ol className="panel flex flex-col gap-1 !rounded-3xl p-2">
            {data.creators.slice(3).map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl p-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tint text-sm font-bold text-accent-text">{i + 4}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted">
                    {c.posts} scored {c.posts === 1 ? "caption" : "captions"}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-bold tabular-nums">+{c.score}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Gallery
        id="gallery-captions"
        kicker="The permanent collection"
        title="The Feed's Favorites"
        items={data.captions}
        featureFirst
        firstRibbon="Masterpiece"
        empty={`No captions have a positive score ${periodLabel}. Vote in the feed and the first exhibit will be hung.`}
        onOpen={(i, el) => open("captions", i, el)}
      />
      <Gallery
        id="gallery-arena"
        kicker="Hand-picked by the crowd"
        title="Arena Champions"
        items={data.arena}
        empty="No caption has won enough battles yet. A caption needs at least 2 battles and a win. Play in the Arena!"
        onOpen={(i, el) => open("arena", i, el)}
      />
      <Gallery
        id="gallery-winners"
        kicker="Crowned at midnight"
        title="The Winners' Wing"
        items={data.winners}
        empty="No Daily Drop has crowned a winner yet."
        onOpen={(i, el) => open("winners", i, el)}
      />

      {viewer && (
        <ExhibitViewer
          key={`${viewer.gallery}-${viewer.masterpiece}`}
          items={items(viewer.gallery)}
          index={viewer.index}
          galleryName={NAMES[viewer.gallery]}
          masterpiece={viewer.masterpiece && viewer.index === 0}
          onIndex={(i) => setViewer({ ...viewer, index: i, masterpiece: viewer.gallery === "captions" && i === 0 ? viewer.masterpiece : false })}
          onClose={close}
        />
      )}
    </>
  );
}
