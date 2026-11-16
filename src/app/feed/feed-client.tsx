"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { NoticeToast, usePostActions } from "@/components/use-post-actions";
import { feedGuidance } from "@/lib/guidance";
import { voiceTheme } from "@/lib/voice-theme";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/ui";
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
        <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
          Could not load the feed. Refresh the page to try again.
        </p>
      )}

      {actions.posts.length > 0 && (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-6">
          <div className="panel flex flex-col gap-4 p-4 sm:p-5">
            <Guide guidance={feedGuidance({ posts: visible.length, voice })} size="sm" as="h3" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="feed-heading" className="sr-only">
                Captions
              </h2>
              {actions.posts.length > 1 && (
                <div role="group" aria-label="Sort the feed" className="inline-flex rounded-full bg-sunken p-1 ring-1 ring-line">
                  <SortButton active={sort === "recent"} onClick={() => chooseSort("recent")}>
                    Recent
                  </SortButton>
                  <SortButton active={sort === "top"} onClick={() => chooseSort("top")}>
                    Top rated
                  </SortButton>
                </div>
              )}
              <button type="button" onClick={surprise} className="btn-quiet btn-sm press">
                <Icon name="shuffle" className="h-3.5 w-3.5" /> Surprise me
              </button>
            </div>
            {usedVoices.length > 0 && (
              <div role="group" aria-label="Filter by voice" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                <FilterChip active={voice === null} onClick={() => setVoice(null)}>
                  All voices
                </FilterChip>
                {usedVoices.map((v) => (
                  <FilterChip key={v.id} dot={v.id} active={voice === v.id} onClick={() => setVoice(voice === v.id ? null : v.id)}>
                    {v.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <ul className="columns-1 gap-6 md:columns-2 xl:columns-3 [&>li]:mb-6 [&>li]:break-inside-avoid">
            {visible.map((post: FeedPost) => (
              <li key={post.id}>
                <PostCard post={post} onVote={actions.castVote} onDelete={actions.removePost} />
              </li>
            ))}
          </ul>
          {visible.length === 0 && (
            <EmptyState title="Nothing in that voice yet" mood="curious">
              Try another voice, or make the first one yourself.
            </EmptyState>
          )}
        </section>
      )}

      <NoticeToast notice={actions.notice} onDismiss={actions.dismissNotice} />

      {!loadFailed && actions.posts.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          action={
            <Link href="/studio" className="btn-primary press">
              <Icon name="spark" /> Open the Studio
            </Link>
          }
        >
          Be the first to turn a photo into a punchline.
        </EmptyState>
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
      className={`min-h-9 rounded-full px-4 text-sm transition-all ${
        active ? "bg-surface-solid font-semibold text-accent-text shadow-[var(--shadow-sm)]" : "font-medium text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children, dot }: { active: boolean; onClick: () => void; children: React.ReactNode; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1 text-sm transition-colors ${
        active ? "border-accent bg-tint font-semibold text-accent-text" : "border-line-strong bg-surface-solid font-medium text-muted hover:border-accent hover:text-ink"
      }`}
    >
      {dot && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${voiceTheme(dot).from}, ${voiceTheme(dot).to})` }} />}
      {children}
    </button>
  );
}
