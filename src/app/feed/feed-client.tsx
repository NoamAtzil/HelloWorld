"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { NoticeToast, usePostActions } from "@/components/use-post-actions";
import { PostCard } from "@/components/post-card";
import { VOICES } from "@/lib/voices";
import { sortPosts, type FeedPost, type FeedSort } from "./sort";

export function FeedClient({
  posts,
  initialSort,
  loadFailed,
}: {
  posts: FeedPost[];
  initialSort: FeedSort;
  loadFailed: boolean;
}) {
  const [sort, setSort] = useState<FeedSort>(initialSort);
  const [voice, setVoice] = useState<string | null>(null);
  const actions = usePostActions(posts);

  const usedVoices = useMemo(
    () => VOICES.filter((v) => actions.posts.some((p) => p.voice === v.id)),
    [actions.posts],
  );

  const visible = useMemo(
    () => sortPosts(actions.posts.filter((p) => !voice || p.voice === voice), sort),
    [actions.posts, sort, voice],
  );

  const chooseSort = useCallback((next: FeedSort) => {
    setSort(next);
    // Keep the choice in the URL (refresh / share) without a navigation.
    window.history.replaceState(null, "", next === "top" ? "/feed?sort=top" : "/feed");
  }, []);

  // Jump to a random caption: a way to wander.
  function surprise() {
    if (visible.length === 0) return;
    const post = visible[Math.floor(Math.random() * visible.length)];
    const el = document.getElementById(`post-${post.id}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  return (
    <>
      {loadFailed && (
        <p role="alert" className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text">
          Could not load the feed. Refresh the page to try again.
        </p>
      )}

      {actions.posts.length > 0 && (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="feed-heading" className="sr-only">
                Captions
              </h2>
              {actions.posts.length > 1 && (
                <div role="group" aria-label="Sort the feed" className="inline-flex rounded-full border border-line bg-surface p-1">
                  <SortButton active={sort === "recent"} onClick={() => chooseSort("recent")}>
                    Recent
                  </SortButton>
                  <SortButton active={sort === "top"} onClick={() => chooseSort("top")}>
                    Top rated
                  </SortButton>
                </div>
              )}
              <button type="button" onClick={surprise} className="btn-quiet press min-h-9 px-3 text-sm">
                Surprise me
              </button>
            </div>
            {usedVoices.length > 0 && (
              <div role="group" aria-label="Filter by voice" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                <FilterChip active={voice === null} onClick={() => setVoice(null)}>
                  All voices
                </FilterChip>
                {usedVoices.map((v) => (
                  <FilterChip key={v.id} active={voice === v.id} onClick={() => setVoice(voice === v.id ? null : v.id)}>
                    {v.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <ul className="flex flex-col gap-12">
            {visible.map((post: FeedPost) => (
              <li key={post.id}>
                <PostCard post={post} onVote={actions.castVote} onDelete={actions.removePost} />
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No captions with that voice yet.
            </p>
          )}
        </section>
      )}

      <NoticeToast notice={actions.notice} onDismiss={actions.dismissNotice} />

      {!loadFailed && actions.posts.length === 0 && (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center">
          <p className="text-lg font-semibold tracking-tight">Nothing here yet.</p>
          <p className="text-sm text-muted">Be the first to turn a photo into a punchline.</p>
          <Link href="/studio" className="btn-primary press">
            Open the Studio
          </Link>
        </div>
      )}
    </>
  );
}

function SortButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full px-4 text-sm ${
        active ? "bg-tint font-semibold text-accent-text" : "font-medium text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
        active ? "border-accent bg-tint font-semibold text-accent-text" : "border-line bg-surface font-medium text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
