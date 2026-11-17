"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown, nextDropReset } from "@/lib/drop";

// A live countdown to the next reset (midnight America/New_York). The reset is a
// real instant (see nextDropReset), so daylight-saving days are exact. It renders
// a fixed placeholder on the server and first paint, then ticks on the client, so
// there is never a hydration mismatch. `onReset` fires once when the day turns over.
export function Countdown({ onReset }: { onReset?: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const cb = useRef(onReset);
  useEffect(() => {
    cb.current = onReset;
  });

  useEffect(() => {
    let timer = 0;
    let target = nextDropReset().getTime();
    const tick = () => {
      const now = Date.now();
      if (now >= target) {
        target = nextDropReset(new Date(now)).getTime();
        cb.current?.();
      }
      setText(formatCountdown(target - now).text);
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return <>{text ?? "--:--:--"}</>;
}
