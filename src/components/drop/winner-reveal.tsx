"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { WinnerCard } from "@/components/winner-card";
import { CONFETTI_GOLD, fireConfetti, stopConfetti } from "@/lib/confetti";
import { DROP_WINNER_KEY } from "@/lib/drop";
import { winnerGuidance, type WinnerPhase } from "@/lib/guidance";
import { getAudio } from "@/lib/sound/engine";
import { useSound } from "@/lib/sound/use-sound";

export type Winner = {
  key: string;
  content: string;
  imageUrl: string | null;
  author: string;
  voice: string | null;
  score: number;
};

type State = "closed" | "drum" | "open";

const noSubscribe = () => () => {};
function wantsReveal(key: string | null): boolean {
  if (!key) return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return window.localStorage.getItem(DROP_WINNER_KEY) !== key;
  } catch {
    return false;
  }
}

// Yesterday's winner, as a tiny awards ceremony: a spotlight rises, a drumroll,
// the curtains part, and the winning caption and its real author are revealed with
// golden confetti and a fanfare. It only ever shows a winner the database named,
// plays once per winner (then it's just the card, with a replay button), and is
// skippable. With no winner there is a plain, honest empty stage instead.
export function WinnerReveal({ winner, dateLabel }: { winner: Winner | null; dateLabel: string }) {
  const audio = getAudio();
  useSound("drop");
  const wants = useSyncExternalStore(noSubscribe, () => wantsReveal(winner?.key ?? null), () => false);
  const [stage, setStage] = useState<"pending" | State>("pending");
  const state: State = stage === "pending" ? (wants ? "closed" : "open") : stage;
  const setState = setStage;
  const root = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const handled = useRef(false);
  const armed = useRef(false);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const remember = () => {
    if (!winner) return;
    try {
      window.localStorage.setItem(DROP_WINNER_KEY, winner.key);
    } catch {
      /* ignore */
    }
  };

  function play() {
    if (!winner) return;
    clear();
    armed.current = false;
    remember();
    setState("drum");
    audio.play("d_drumroll");
    at(1450, () => {
      setState("open");
      audio.play("d_fanfare", { gain: 0.9 });
      audio.play("d_applause", { gain: 0.55, delay: 0.3 });
      const r = root.current?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? Math.max(80, r.top + 120) : window.innerHeight / 3;
      fireConfetti({ x, y, count: 80, angle: -90, spread: 120, speed: 820, colors: CONFETTI_GOLD, gravity: 0.9 });
      fireConfetti({ x: x - 160, y: y + 30, count: 30, angle: -60, spread: 50, speed: 700, colors: CONFETTI_GOLD });
      fireConfetti({ x: x + 160, y: y + 30, count: 30, angle: -120, spread: 50, speed: 700, colors: CONFETTI_GOLD });
    });
  }

  function skip() {
    clear();
    stopConfetti();
    audio.stopAll(0.05);
    remember();
    setState("open");
  }

  function replay() {
    flushSync(() => setState("closed"));
    play();
  }

  // On first view of this winner the curtains are already closed (derived above); run
  // the reveal when the section scrolls into view. `wants` is false on the server and on
  // the first client render, so this waits for it to become true.
  useEffect(() => {
    document.documentElement.removeAttribute("data-drop-winner");
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!wants || !winner || !el || handled.current) return;
    handled.current = true;
    armed.current = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (armed.current && entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect(); // timers are cleared on unmount, below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wants]);

  useEffect(
    () => () => {
      clear();
      stopConfetti();
    },
    [],
  );

  const phase: WinnerPhase = !winner ? "none" : state;
  const guidance = winnerGuidance({ phase, author: winner?.author });

  return (
    <section ref={root} className="awards" data-state={state} aria-labelledby="yesterday">
      <div className="awards-spot" aria-hidden="true" />
      <div className="awards-body">
        <div>
          <p className="eyebrow">Yesterday · {dateLabel}</p>
          <h2 id="yesterday" className="mt-1 text-2xl">
            {winner ? "Yesterday's winner" : "No winner yesterday"}
          </h2>
        </div>
        <Guide guidance={guidance} eyebrow="Your host" size="sm" />

        {winner ? (
          <>
            <p className="awards-announce" aria-live="polite">
              {state === "closed" ? "Tonight's trophy goes to…" : state === "drum" ? "And the winner is…" : ""}
            </p>
            <div className="awards-stage">
              <div className="awards-gold awards-card">
                <WinnerCard imageUrl={winner.imageUrl} content={winner.content} author={winner.author} voice={winner.voice} score={winner.score} label="Winner" />
              </div>
              <div className="awards-curtain l" aria-hidden="true" />
              <div className="awards-curtain r" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {state === "drum" || state === "closed" ? (
                <button type="button" onClick={skip} className="btn-quiet btn-sm" aria-label="Skip the reveal">
                  Skip <Icon name="arrow" className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="button" onClick={replay} className="show-btn">
                  <Icon name="retry" className="h-3.5 w-3.5" /> Replay the reveal
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 pb-3 text-center">
            <div className="awards-empty-stand" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted">
              Nobody took the trophy on {dateLabel}. A winner needs at least one entry with a positive score. Tonight&apos;s entries could change that.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
