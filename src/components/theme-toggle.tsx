"use client";

import { useSyncExternalStore } from "react";

type Pref = "light" | "system" | "dark";
const KEY = "caption-theme";
const EVENT = "caption-theme-change";

function readPref(): Pref {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// The saved preference is an external store (localStorage). While it is
// "system" the page also follows the operating system live.
function subscribe(callback: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    resolve(readPref());
    callback();
  };
  window.addEventListener("storage", onSystem);
  window.addEventListener(EVENT, onSystem);
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener("storage", onSystem);
    window.removeEventListener(EVENT, onSystem);
    media.removeEventListener("change", onSystem);
  };
}

const OPTIONS: { value: Pref; label: string; path: string }[] = [
  { value: "light", label: "Light", path: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { value: "system", label: "System", path: "M3 5h18v11H3zM8 20h8M12 16v4" },
  { value: "dark", label: "Dark", path: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" },
];

export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as Pref);

  function choose(next: Pref) {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    resolve(next);
    window.dispatchEvent(new Event(EVENT));
  }

  // Radio-group keyboard pattern: one tab stop, arrows move and select.
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = OPTIONS.findIndex((o) => o.value === pref);
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
    choose(next.value);
    (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown} className="flex rounded-xl border border-line bg-surface-strong p-0.5">
      {OPTIONS.map((option) => {
        const active = pref === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-value={option.value}
            tabIndex={active ? 0 : -1}
            aria-label={option.label}
            title={option.label}
            onClick={() => choose(option.value)}
            className={`grid h-8 w-8 place-items-center rounded-[0.6rem] transition-colors ${
              active ? "bg-tint text-accent-text shadow-[inset_0_0_0_1px_rgb(255_122_26/0.3)]" : "text-muted hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={option.path} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
