"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Creature } from "@/components/creature";
import { Icon } from "@/components/icons";
import { CONFETTI_GOLD, CONFETTI_PARTY, fireConfetti, stopConfetti } from "@/lib/confetti";
import type { Mood } from "@/lib/mood";
import { getAudio } from "@/lib/sound/engine";

type Step = "pre" | "in" | "grab" | "stamp" | "toss" | "inbox" | "end";

// The moment a caption is entered into the Daily Drop. It plays only AFTER the
// server has confirmed the entry. The caption becomes a paper entry card, the host
// grabs it, stamps it, tosses it into the entries box, and "YOU'RE IN!" lands with
// confetti, a chime and a little applause. About four seconds, skippable.
const TIMELINE: ReadonlyArray<readonly [Step, number]> = [
  ["in", 40],
  ["grab", 700],
  ["stamp", 1300],
  ["toss", 1900],
  ["inbox", 2500],
  ["end", 4400],
];
const DONE_AT = 4850;

const MOOD: Record<Step, Mood> = { pre: "curious", in: "curious", grab: "inspired", stamp: "inspired", toss: "inspired", inbox: "proud", end: "proud" };

export function SubmissionCeremony({ caption, from, onDone }: { caption: string; from: DOMRect | null; onDone: () => void }) {
  const [step, setStep] = useState<Step>("pre");
  const [mounted, setMounted] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  const finished = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    stopConfetti();
    getAudio().stopAll(0.06);
    doneRef.current();
  }

  // Start the card exactly where the caption plate was (so it feels like the same object).
  useLayoutEffect(() => {
    if (!mounted) return;
    const c = card.current;
    if (!c || !from) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--fx", `${from.left + from.width / 2 - (r.left + r.width / 2)}px`);
    c.style.setProperty("--fy", `${from.top + from.height / 2 - (r.top + r.height / 2)}px`);
    c.style.setProperty("--fs", String(Math.min(1.3, Math.max(0.4, from.width / r.width))));
  }, [mounted, from]);

  useEffect(() => {
    if (!mounted) return;
    const audio = getAudio();
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));
    for (const [s, t] of TIMELINE) at(t, () => setStep(s));
    at(1300, () => audio.play("d_stamp"));
    at(1900, () => audio.play("d_drop"));
    at(2500, () => {
      audio.play("d_chime", { gain: 0.9 });
      audio.play("d_pop", { gain: 0.8 });
      audio.play("d_applause", { gain: 0.55, delay: 0.25 });
      const r = box.current?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const y = r ? r.top : window.innerHeight / 2;
      fireConfetti({ x, y, count: 70, angle: -90, spread: 100, speed: 820, colors: CONFETTI_GOLD });
      fireConfetti({ x: 0, y: window.innerHeight * 0.55, count: 40, angle: -50, spread: 40, speed: 900, colors: CONFETTI_PARTY });
      fireConfetti({ x: window.innerWidth, y: window.innerHeight * 0.55, count: 40, angle: -130, spread: 40, speed: 900, colors: CONFETTI_PARTY });
    });
    at(DONE_AT, finish);
    skipBtn.current?.focus();
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, [mounted]);

  useEffect(
    () => () => {
      stopConfetti();
    },
    [],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="cer"
      data-step={step}
      role="dialog"
      aria-modal="true"
      aria-label="Entering your caption into today's Daily Drop"
      onKeyDown={(e) => {
        if (e.key === "Escape") finish();
      }}
    >
      <div className="cer-scrim" onClick={finish} />
      <div className="cer-scene">
        <div className="cer-spot" aria-hidden="true" />
        <p className="cer-in" aria-hidden="true">
          You&apos;re in!
        </p>
        <p className="cer-sub">Your entry is in the box. Voting stays open until midnight Eastern.</p>
        <div ref={card} className="cer-card">
          <span className="tag">Tonight&apos;s entry</span>
          <p>{caption}</p>
          <span className="cer-stamp" aria-hidden="true">
            Entered
          </span>
        </div>
        <div className="cer-host" aria-hidden="true">
          <Creature mood={MOOD[step]} />
        </div>
        <div ref={box} className="cer-box" aria-hidden="true">
          <span>Entries</span>
        </div>
      </div>
      <button ref={skipBtn} type="button" onClick={finish} className="cer-skip btn-quiet btn-sm" aria-label="Skip the ceremony">
        Skip <Icon name="arrow" className="h-3.5 w-3.5" />
      </button>
      <p role="status" className="sr-only">
        {step === "inbox" || step === "end" ? "You're in! Your entry is in the box." : "Entering your caption…"}
      </p>
    </div>,
    document.body,
  );
}
