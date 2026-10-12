"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SCENES } from "./scenes";

type Phase = "idle" | "writing" | "done";

export function DemoPlayground({ signedIn }: { signedIn: boolean }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scene = SCENES[index];

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function pick(next: number) {
    if (timer.current) clearTimeout(timer.current);
    setIndex(next);
    setPhase("idle");
  }

  function writeCaption() {
    if (phase === "writing") return;
    setPhase("writing");
    // A short pause so the demo feels like the real generate step.
    timer.current = setTimeout(() => setPhase("done"), 1100);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Choose an example scene"
        className="grid grid-cols-3 gap-3"
      >
        {SCENES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => pick(i)}
            aria-pressed={i === index}
            className={`press flex flex-col gap-1.5 rounded-2xl border p-1.5 text-left ${
              i === index
                ? "border-accent bg-tint"
                : "border-line bg-surface hover:bg-tint"
            }`}
          >
            <svg
              viewBox="0 0 400 300"
              preserveAspectRatio="xMidYMid slice"
              className="aspect-[4/3] w-full overflow-hidden rounded-xl"
              aria-hidden="true"
            >
              {s.art}
            </svg>
            <span
              className={`px-1 text-xs ${
                i === index ? "font-semibold text-accent-text" : "text-muted"
              }`}
            >
              {s.label}
            </span>
          </button>
        ))}
      </div>

      <div>
        {/* SCENE: the (example) reality. */}
        <div
          className={`relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card ${
            phase === "writing" ? "is-bending" : ""
          }`}
        >
          <svg
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={`Example scene: ${scene.label}`}
            className="aspect-[4/3] w-full"
          >
            {scene.art}
          </svg>
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
            Demo scene
          </span>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
          />
        </div>

        {/* CAPTION: ghost until it is "written", then the real bent plate. */}
        <div aria-live="polite">
          {phase === "done" ? (
            <div className="bend-plate relative z-[1] mx-3 -mt-10 border border-glow/30 bg-tint px-5 pb-6 pt-4 pr-12 shadow-card">
              <p className="text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
                {scene.caption}
              </p>
            </div>
          ) : (
            <div className="bend-plate relative mx-3 -mt-8 border border-dashed border-glow/60 bg-tint/90 px-5 py-4 pr-12 text-sm font-medium text-accent-text">
              {phase === "writing" ? "Finding the joke…" : "Your caption lands here"}
            </div>
          )}
        </div>
      </div>

      {phase !== "done" ? (
        <button
          type="button"
          onClick={writeCaption}
          disabled={phase === "writing"}
          className="btn-primary press w-full sm:w-auto sm:self-start"
        >
          {phase === "writing" ? "Finding the joke…" : "Write the caption"}
        </button>
      ) : (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">This was a demo.</span>{" "}
            The caption is a pre-written sample, no AI ran and nothing was
            saved. Signed-in users get a real caption for their own photo, and
            can vote on everyone&apos;s.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={signedIn ? "/feed" : "/login"}
              className="btn-primary press"
            >
              {signedIn ? "Open the feed" : "Sign in to create your own"}
            </Link>
            <button
              type="button"
              onClick={() => pick((index + 1) % SCENES.length)}
              className="btn-quiet press"
            >
              Try another scene
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
