"use client";

import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Reveals text progressively, once. Honors reduced motion (shows it all at
// once). Rendered only after the user acts, so reading matchMedia in the
// initializer cannot cause a hydration mismatch.
export function Typewriter({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0));

  useEffect(() => {
    if (shown >= text.length) return;
    // A timer (not requestAnimationFrame) so it also advances in background tabs.
    const total = Math.min(1400, Math.max(450, text.length * 9));
    const start = performance.now();
    const id = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / total);
      setShown(Math.ceil(progress * text.length));
      if (progress >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
    // Runs once per text: `shown` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
    </span>
  );
}
