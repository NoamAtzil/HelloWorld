"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";
import { deletePost, setVote, type ActionResult } from "@/app/feed/actions";
import { applyVote, type FeedPost } from "@/app/feed/sort";

type OptimisticAction =
  | { kind: "vote"; id: number; value: 1 | -1 }
  | { kind: "delete"; id: number };

// Optimistic voting and deleting with a short, friendly notice on failure
// (the optimistic change snaps back on its own once the action finishes).
export type VoteOutcome = { id: number; /** the vote after this action: 1, -1, or 0 (cleared) */ next: 1 | -1 | 0; ok: boolean };

export function usePostActions(posts: FeedPost[], opts?: { onVote?: (outcome: VoteOutcome) => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function showNotice(message: string) {
    if (timer.current) clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => setNotice(null), 7000);
  }

  function dismissNotice() {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }

  /** Runs a server action; shows a friendly notice on failure and says whether it worked. */
  async function attempt(action: () => Promise<ActionResult>, fallbackMessage: string): Promise<boolean> {
    try {
      const result = await action();
      if (result?.error) {
        showNotice(result.error);
        return false;
      }
      return true;
    } catch {
      showNotice(fallbackMessage);
      return false;
    }
  }

  const [optimistic, applyOptimistic] = useOptimistic(
    posts,
    (current: FeedPost[], action: OptimisticAction) =>
      action.kind === "delete"
        ? current.filter((post) => post.id !== action.id)
        : current.map((post) => (post.id === action.id ? applyVote(post, action.value) : post)),
  );

  async function castVote(id: number, value: 1 | -1, formData: FormData) {
    const previous = optimistic.find((post) => post.id === id)?.myVote ?? 0;
    applyOptimistic({ kind: "vote", id, value });
    const ok = await attempt(() => setVote(formData), "Couldn't save your vote. Check your connection and try again.");
    opts?.onVote?.({ id, next: previous === value ? 0 : value, ok });
  }

  async function removePost(id: number, formData: FormData) {
    applyOptimistic({ kind: "delete", id });
    await attempt(() => deletePost(formData), "Couldn't delete that post. Check your connection and try again.");
  }

  return { posts: optimistic, castVote, removePost, notice, dismissNotice };
}

// Always rendered so screen readers announce the message when it appears.
export function NoticeToast({ notice, onDismiss }: { notice: string | null; onDismiss: () => void }) {
  return (
    <div role="alert" className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-center">
      {notice && (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-coral/40 bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text shadow-[var(--shadow)]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
