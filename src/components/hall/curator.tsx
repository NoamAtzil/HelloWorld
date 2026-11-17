"use client";

import { useEffect, useState } from "react";
import { Creature } from "@/components/creature";
import type { Mood } from "@/lib/mood";
import { Trophy } from "./trophy";

// The museum curator: the real Caption Creature, in a tiny bow tie, polishing the
// trophy. Every so often it looks up and reacts with a little hop and a "pip".
// With reduced motion it stands still and does not react on its own.
export function Curator({ mood, onReact }: { mood: Mood; onReact?: () => void }) {
  const [react, setReact] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t1 = 0;
    let t2 = 0;
    const schedule = () => {
      t1 = window.setTimeout(() => {
        setReact(true);
        onReact?.();
        t2 = window.setTimeout(() => {
          setReact(false);
          schedule();
        }, 1500);
      }, 9000 + Math.random() * 8000);
    };
    schedule();
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Timers belong to the mounted curator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="curator" aria-hidden="true">
      <div className="curator-floor" />
      <div className={`curator-creature ${react ? "hop" : ""}`} data-polish={!react} style={{ "--gx": 0.85, "--gy": 0.4 } as React.CSSProperties}>
        <Creature mood={react ? "inspired" : mood} bowtie />
      </div>
      <div className="curator-pedestal" />
      <Trophy className="curator-trophy" />
      <div className="curator-cloth" />
      <span className="curator-glint">✦</span>
    </div>
  );
}
