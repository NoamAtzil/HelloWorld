"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { fireConfetti, stopConfetti, CONFETTI_GOLD } from "@/lib/confetti";
import { getAudio } from "@/lib/sound/engine";
import type { ExhibitData } from "./types";

type Stage = "dark" | "spot" | "lit" | "done";

export const MASTERPIECE_LINE = "Ladies and gentlemen… a masterpiece of questionable humor.";

// The focused view of one exhibit. For the highest-ranked caption it opens with a
// short, skippable spotlight reveal: the lights come up, gold shimmers across the
// frame and the announcer reads the line (shown as text too). Sound is opt-in.
export function ExhibitViewer({
  items,
  index,
  galleryName,
  masterpiece,
  onIndex,
  onClose,
}: {
  items: ExhibitData[];
  index: number;
  galleryName: string;
  /** True only for the highest-ranked caption: plays the reveal. */
  masterpiece: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>(masterpiece ? "dark" : "done");
  const [replay, setReplay] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  function skip() {
    clear();
    stopConfetti();
    getAudio().stopAll(0.05);
    setStage("done");
  }

  // The reveal: dark -> spotlight -> lit (shimmer + announcer) -> done.
  useEffect(() => {
    if (!mounted || !masterpiece) return;
    const audio = getAudio();
    const sounding = audio.isReady("hall");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      at(0, () => setStage("done"));
      return;
    }
    at(0, () => setStage("dark"));
    at(250, () => {
      setStage("spot");
      audio.play("h_spot");
    });
    at(650, () => {
      setStage("lit");
      audio.play("h_shimmer", { gain: 0.8 });
      audio.say("h_masterpiece");
      fireConfetti({ x: window.innerWidth / 2, y: window.innerHeight * 0.32, count: 60, angle: -90, spread: 120, speed: 600, colors: CONFETTI_GOLD, gravity: 0.7, ttl: 2.2 });
    });
    at(sounding ? 4800 : 2800, () => setStage("done"));
    return () => clear();
  }, [mounted, masterpiece, replay]);

  // Return everything to rest when the viewer goes away.
  useEffect(
    () => () => {
      clear();
      stopConfetti();
      getAudio().stopAll(0.05);
    },
    [],
  );

  useEffect(() => {
    if (mounted) closeBtn.current?.focus();
  }, [mounted]);

  if (!mounted || !item) return null;

  const revealing = stage !== "done";
  const go = (d: number) => {
    if (revealing) return;
    onIndex((index + d + items.length) % items.length);
  };

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "Tab" && panel.current) {
      // keep focus inside the dialog
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>("button, a[href]")).filter((x) => !x.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <div className="hv" data-stage={stage} role="dialog" aria-modal="true" aria-label={`Exhibit ${item.noLabel}`} onKeyDown={onKey}>
      <div className="hv-scrim" onClick={onClose} />
      <div ref={panel} className="hv-panel">
        <div className="hv-spot" aria-hidden="true" />
        <button ref={closeBtn} type="button" onClick={onClose} className="hv-x hh-btn" aria-label="Close the exhibit">
          <Icon name="close" className="h-3.5 w-3.5" /> Close
        </button>
        <p className="hh-eyebrow pr-24">
          {galleryName} · {item.noLabel}
        </p>

        <div className="hv-frame">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.content} />
          ) : (
            <div className="grid min-h-40 place-items-center text-[#5a3d0f]">Photo unavailable</div>
          )}
        </div>

        {masterpiece && revealing && (
          <p className="hv-line" role="status" aria-live="polite" style={{ opacity: stage === "lit" ? 1 : 0 }}>
            {MASTERPIECE_LINE}
          </p>
        )}

        <div className="hv-body">
          <p className="hv-caption">{item.content}</p>
          <p className="hv-meta">
            <span>
              by <b>{item.author}</b>
            </span>
            {item.voice && <span>{item.voice}</span>}
            <span>
              <b>{item.stat}</b> {item.statLabel}
            </span>
          </p>
          {masterpiece && !revealing && <p className="hv-line !min-h-0 !text-left !text-[0.95rem]">{MASTERPIECE_LINE}</p>}
        </div>

        <div className="hv-nav">
          {revealing ? (
            <button type="button" onClick={skip} className="hh-btn" aria-label="Skip the reveal">
              Skip <Icon name="arrow" className="h-3.5 w-3.5" />
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                <button type="button" className="hh-btn" onClick={() => go(-1)} disabled={items.length < 2} aria-label="Previous exhibit">
                  ← Previous
                </button>
                <button type="button" className="hh-btn" onClick={() => go(1)} disabled={items.length < 2} aria-label="Next exhibit">
                  Next →
                </button>
              </div>
              {masterpiece && (
                <button
                  type="button"
                  className="hh-btn"
                  onClick={() => {
                    getAudio().stopAll(0.05);
                    setStage("dark");
                    setReplay((n) => n + 1);
                  }}
                >
                  <Icon name="retry" className="h-3.5 w-3.5" /> Replay the announcement
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
