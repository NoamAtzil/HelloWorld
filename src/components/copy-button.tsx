"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";

export function CopyButton({ text, label = "Copy caption", className = "btn-quiet btn-sm" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <button type="button" onClick={copy} className={className}>
      <Icon name={state === "copied" ? "check" : "copy"} />
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}</span>
    </button>
  );
}
