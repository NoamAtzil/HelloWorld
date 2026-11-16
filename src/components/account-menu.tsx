"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const initial = (email[0] ?? "?").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[var(--btn-from)] to-accent text-sm font-bold text-on-accent shadow-[var(--shadow-sm)] transition-transform hover:scale-105"
      >
        {initial}
      </button>
      {open && (
        <div className="panel pop-in absolute right-0 top-11 z-40 w-64 p-2">
          <p className="truncate px-3 pb-2 pt-1.5 text-xs text-muted" title={email}>
            Signed in as <span className="font-semibold text-ink">{email}</span>
          </p>
          <button type="button" onClick={signOut} className="btn-ghost w-full !justify-start">
            <Icon name="logout" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
