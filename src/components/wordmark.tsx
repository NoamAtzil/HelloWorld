"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Creature } from "@/components/creature";

// "why so serious?" as a compact wss? that unfolds into a staircase.
//
// Each letter of the compact mark is the first letter of a word (w-hy, s-o,
// s-erious) and the "?" is the last mark of the last word, so unfolding is
// literally growing the missing letters out of the initials.
//
// The rest state is plain inline flow (pixel-exact, no layout cost). Playing
// the sequence measures the three words once, pins them absolutely at those
// exact spots (so nothing moves), and then CSS transitions do the choreography
// keyed on `data-step`. The expanded mark floats over the page: the header
// keeps its compact size and nothing else is ever pushed around.
//
// The creature is the real Caption Creature. Its wink is the existing per-eye
// lid, brow and antenna-glow variables, driven from wordmark.css.

type Step = "rest" | "open" | "peek" | "react" | "swap" | "close";

// When each step starts (ms), and when the whole thing is back at rest.
const TIMELINE: ReadonlyArray<readonly [Step, number]> = [
  ["open", 0],
  ["peek", 950],
  ["react", 1750],
  ["swap", 2750],
  ["close", 4700],
];
const TOTAL = 5800;
const EXPANDED: ReadonlySet<Step> = new Set<Step>(["open", "peek", "react", "swap"]);

const WORDS = [
  { ini: "w", suf: "hy" },
  { ini: "s", suf: "o" },
  { ini: "s", suf: "erious" },
] as const;

// Module scope so it survives the layout re-rendering, and resets on a real reload.
let introPlayed = false;

export function Wordmark() {
  const pathname = usePathname();
  const line = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const running = useRef(false);
  const [step, setStep] = useState<Step>("rest");

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const release = useCallback(() => {
    const el = line.current;
    if (!el) return;
    el.style.removeProperty("width");
    el.style.removeProperty("height");
    el.querySelectorAll<HTMLElement>("[data-w]").forEach((w) => {
      w.style.removeProperty("--x");
      w.style.removeProperty("--y");
    });
  }, []);

  const play = useCallback(() => {
    const el = line.current;
    if (!el || running.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.hidden) return;
    running.current = true;

    // Freeze the compact layout: pin the box and each word where it already is.
    const box = el.getBoundingClientRect();
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;
    el.querySelectorAll<HTMLElement>("[data-w]").forEach((w) => {
      w.style.setProperty("--x", `${w.offsetLeft}px`);
      w.style.setProperty("--y", `${w.offsetTop}px`);
    });

    for (const [s, at] of TIMELINE) {
      timers.current.push(window.setTimeout(() => setStep(s), at));
    }
    timers.current.push(
      window.setTimeout(() => {
        setStep("rest");
        running.current = false;
        release();
      }, TOTAL),
    );
  }, [release]);

  // The signature moment: once when the homepage first loads (after fonts are
  // ready so the measured positions are final). Never again on route changes.
  useEffect(() => {
    if (pathname !== "/" || introPlayed) return;
    let cancelled = false;
    const start = window.setTimeout(() => {
      void (document.fonts?.ready ?? Promise.resolve()).then(() => {
        if (cancelled) return;
        introPlayed = true;
        play();
      });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [pathname, play]);

  useEffect(
    () => () => {
      clearTimers();
      running.current = false;
    },
    [],
  );

  const miniMood = step === "react" ? "inspired" : "curious";

  return (
    <Link
      href="/"
      aria-label="why so serious? home"
      className="wss"
      data-step={step}
      data-open={EXPANDED.has(step) ? "true" : "false"}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") play();
      }}
      // Touch: a tap both goes home (normal link) and plays the sequence.
      onPointerUp={(e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") play();
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) play();
      }}
    >
      <span ref={line} className="wss-line" aria-hidden="true">
        {WORDS.map((word, i) => (
          <span key={i} data-w className="wss-word" style={{ "--i": i } as React.CSSProperties}>
            <span className="wss-ini">{word.ini}</span>
            <span className="wss-suf">
              <span>{word.suf}</span>
            </span>
            {i === 2 && <span className="wss-q">?</span>}

            {/* A very small creature, standing beside "so", reading along. */}
            {i === 1 && (
              <span className="wss-mini">
                <span className="wss-hop">
                  <Creature mood={miniMood} />
                </span>
              </span>
            )}
            {/* Then a larger one, beside "serious?", with a wink. */}
            {i === 2 && (
              <span className="wss-big">
                <Creature mood="proud" />
              </span>
            )}
          </span>
        ))}
      </span>
    </Link>
  );
}
