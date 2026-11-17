"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import type { Guidance } from "@/lib/guidance";
import { Curator } from "./curator";

// A few motes of gold dust, fixed (not random) so server and client agree.
const MOTES = [
  { x: "6%", s: 4, d: "11s", w: "0s", dx: "1.6rem" },
  { x: "14%", s: 3, d: "14s", w: "3s", dx: "-1.2rem" },
  { x: "22%", s: 5, d: "12s", w: "6s", dx: "1rem" },
  { x: "31%", s: 3, d: "15s", w: "1.5s", dx: "-1.8rem" },
  { x: "39%", s: 4, d: "13s", w: "8s", dx: "1.4rem" },
  { x: "47%", s: 3, d: "16s", w: "4.5s", dx: "-1rem" },
  { x: "55%", s: 5, d: "12s", w: "9.5s", dx: "1.8rem" },
  { x: "63%", s: 3, d: "14s", w: "2.2s", dx: "-1.5rem" },
  { x: "71%", s: 4, d: "13s", w: "7s", dx: "1.1rem" },
  { x: "79%", s: 3, d: "15s", w: "5.2s", dx: "-1.3rem" },
  { x: "87%", s: 5, d: "11s", w: "10.5s", dx: "1.5rem" },
  { x: "94%", s: 3, d: "16s", w: "0.8s", dx: "-1rem" },
];

export function GrandHall({
  guidance,
  period,
  sound,
  onReact,
}: {
  guidance: Guidance;
  period: "week" | "all";
  sound: { supported: boolean; on: boolean; ready: boolean; toggle: () => void };
  onReact: () => void;
}) {
  return (
    <section className="hh" aria-labelledby="hall-heading">
      <div className="hh-pilaster l" aria-hidden="true" />
      <div className="hh-pilaster r" aria-hidden="true" />
      <div className="hh-beam l" aria-hidden="true" />
      <div className="hh-beam r" aria-hidden="true" />
      {MOTES.map((m, i) => (
        <i key={i} className="hh-mote" aria-hidden="true" style={{ "--x": m.x, "--s": `${m.s}px`, "--d": m.d, "--w": m.w, "--dx": m.dx } as React.CSSProperties} />
      ))}

      <div className="hh-grid">
        <div className="flex flex-col gap-4">
          <p className="hh-eyebrow">Established tonight · Admission free</p>
          <h1 id="hall-heading" className="hh-title">
            The Hall of Fame
          </h1>
          <p className="hh-sub">The Museum of Legendary Comedy</p>
          <p className="hh-lede">Real votes, real results. Every name, caption and number on these walls was earned, and nothing here is made up.</p>

          <div className="flex flex-wrap items-center gap-2.5">
            <div role="group" aria-label="Time period" className="hh-toggle">
              {([["week", "This week", "/hall"], ["all", "All time", "/hall?period=all"]] as const).map(([value, label, href]) => (
                <Link key={value} href={href} aria-current={period === value ? "true" : undefined} className="hh-btn !min-h-8 !border-transparent !bg-transparent aria-[current=true]:!border-[var(--gold-3)] aria-[current=true]:!bg-gradient-to-b aria-[current=true]:from-[var(--gold-1)] aria-[current=true]:to-[var(--gold-2)]">
                  {label}
                </Link>
              ))}
            </div>
            {sound.supported && (
              <button
                type="button"
                className="hh-btn"
                aria-pressed={sound.on}
                onClick={sound.toggle}
                title={sound.on && !sound.ready ? "Sound is on. Tap anywhere to start it." : "The museum announcer and gold shimmer. Off until you turn it on."}
              >
                <Icon name={sound.on ? "volume" : "mute"} className="h-3.5 w-3.5" /> Sound: {sound.on ? "on" : "off"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Curator mood={guidance.mood} onReact={onReact} />
          <p role="status" aria-live="polite" className="hh-bubble">
            <b>{guidance.title}</b>
            <span>{guidance.line}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
