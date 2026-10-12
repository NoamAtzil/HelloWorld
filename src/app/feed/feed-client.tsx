"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { deletePost, setVote, type ActionResult } from "./actions";
import { GenerateForm } from "./generate-form";
import {
  applyVote,
  sortPosts,
  type FeedPost,
  type FeedSort,
} from "./sort";

type OptimisticAction =
  | { kind: "vote"; id: number; value: 1 | -1 }
  | { kind: "delete"; id: number };

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

  // Short, friendly message when a vote or delete fails (the optimistic change
  // snaps back on its own once the action finishes).
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  function showNotice(message: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }

  function dismissNotice() {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(null);
  }

  async function attempt(
    action: () => Promise<ActionResult>,
    fallbackMessage: string,
  ) {
    try {
      const result = await action();
      if (result?.error) showNotice(result.error);
    } catch {
      // e.g. the network dropped before the server answered.
      showNotice(fallbackMessage);
    }
  }

  // Votes and deletes show instantly; the server action then revalidates and
  // the real data replaces this (or it snaps back if the action failed).
  const [optimisticPosts, applyOptimistic] = useOptimistic(
    posts,
    (current: FeedPost[], action: OptimisticAction) =>
      action.kind === "delete"
        ? current.filter((post) => post.id !== action.id)
        : current.map((post) =>
            post.id === action.id ? applyVote(post, action.value) : post,
          ),
  );

  const visible = useMemo(
    () => sortPosts(optimisticPosts, sort),
    [optimisticPosts, sort],
  );

  const chooseSort = useCallback((next: FeedSort) => {
    setSort(next);
    // Keep the choice in the URL (refresh / share) without a navigation.
    window.history.replaceState(null, "", next === "top" ? "/feed?sort=top" : "/feed");
  }, []);

  const showRecent = useCallback(() => chooseSort("recent"), [chooseSort]);

  async function castVote(id: number, value: 1 | -1, formData: FormData) {
    applyOptimistic({ kind: "vote", id, value });
    await attempt(
      () => setVote(formData),
      "Couldn't save your vote. Check your connection and try again.",
    );
  }

  async function removePost(id: number, formData: FormData) {
    applyOptimistic({ kind: "delete", id });
    await attempt(
      () => deletePost(formData),
      "Couldn't delete that post. Check your connection and try again.",
    );
  }

  return (
    <>
      <GenerateForm onPosted={showRecent} />

      {loadFailed && (
        <p
          role="alert"
          className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text"
        >
          Could not load the feed. Refresh the page to try again.
        </p>
      )}

      {visible.length > 0 && (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="feed-heading" className="text-xl font-semibold tracking-tight">
              The feed
            </h2>
            {visible.length > 1 && (
              <div
                role="group"
                aria-label="Sort the feed"
                className="inline-flex rounded-full border border-line bg-surface p-1"
              >
                <SortButton
                  active={sort === "recent"}
                  onClick={() => chooseSort("recent")}
                >
                  Recent
                </SortButton>
                <SortButton
                  active={sort === "top"}
                  onClick={() => chooseSort("top")}
                >
                  Top rated
                </SortButton>
              </div>
            )}
          </div>

          <ul className="flex flex-col gap-12">
            {visible.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  onVote={castVote}
                  onDelete={removePost}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Always rendered so screen readers announce the message when it appears. */}
      <div
        role="alert"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-center"
      >
        {notice && (
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-coral/40 bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text shadow-card">
            <span>{notice}</span>
            <button
              type="button"
              onClick={dismissNotice}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold underline underline-offset-2 hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {!loadFailed && visible.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
          <p className="text-lg font-semibold tracking-tight">
            Nothing here yet.
          </p>
          <p className="text-sm text-muted">
            Be the first to turn a photo into a punchline.
          </p>
          <a href="#image" className="btn-primary press">
            Choose a photo
          </a>
        </div>
      )}
    </>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full px-4 text-sm ${
        active
          ? "bg-tint font-semibold text-accent-text"
          : "font-medium text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PostCard({
  post,
  onVote,
  onDelete,
}: {
  post: FeedPost;
  onVote: (id: number, value: 1 | -1, formData: FormData) => Promise<void>;
  onDelete: (id: number, formData: FormData) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <article>
      {/* PHOTO: reality, the hero. Exact corners. */}
      <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt={post.content}
            className="max-h-[34rem] w-full object-cover"
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-sm text-muted">
            Photo unavailable
          </div>
        )}
        {/* The caption seems to rise out of the photo's lower edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent"
        />
        {post.mine &&
          (confirming ? (
            <div
              className="absolute right-3 top-3 flex items-center gap-2"
              onKeyDown={(event) => {
                if (event.key === "Escape") setConfirming(false);
              }}
            >
              <button
                type="button"
                onClick={() => setConfirming(false)}
                autoFocus
                className="h-8 rounded-full bg-black/60 px-3 text-sm font-medium text-white hover:bg-black/80"
              >
                Cancel
              </button>
              <form action={(formData) => onDelete(post.id, formData)}>
                <input type="hidden" name="generation_id" value={post.id} />
                <button
                  type="submit"
                  className="h-8 rounded-full bg-coral px-3 text-sm font-semibold text-on-coral"
                >
                  Delete post
                </button>
              </form>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete post"
              title="Delete post"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/90 hover:bg-black/70 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ))}
      </div>

      {/* CAPTION: the AI's twist. The one permanent bend. */}
      <div className="bend-plate relative z-[1] mx-3 -mt-10 border border-glow/30 bg-tint px-5 pb-6 pt-4 pr-12 shadow-card">
        <p className="text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
          {post.content}
        </p>
      </div>

      {/* REACTION: precise controls. */}
      <div className="mt-3 flex items-center gap-3 px-1">
        <div
          role="group"
          aria-label="Vote on this caption"
          className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface p-1"
        >
          <VoteButton post={post} value={1} onVote={onVote} />
          <span
            aria-live="polite"
            aria-label={`Score ${post.score}`}
            className={`min-w-10 text-center text-base font-semibold tabular-nums ${
              post.myVote === 1
                ? "text-accent-text"
                : post.myVote === -1
                  ? "text-coral-text"
                  : "text-ink"
            }`}
          >
            {post.score}
          </span>
          <VoteButton post={post} value={-1} onVote={onVote} />
        </div>
        {post.direction && (
          <p className="min-w-0 truncate text-sm text-muted">
            Direction: {post.direction}
          </p>
        )}
      </div>
    </article>
  );
}

function VoteButton({
  post,
  value,
  onVote,
}: {
  post: FeedPost;
  value: 1 | -1;
  onVote: (id: number, value: 1 | -1, formData: FormData) => Promise<void>;
}) {
  const up = value === 1;
  const active = post.myVote === value;
  return (
    <form action={(formData) => onVote(post.id, value, formData)}>
      <input type="hidden" name="generation_id" value={post.id} />
      <input type="hidden" name="value" value={value} />
      <button
        type="submit"
        aria-pressed={active}
        aria-label={up ? "Upvote" : "Downvote"}
        className={`vote press grid h-11 w-12 place-items-center rounded-full ${
          active
            ? up
              ? "bg-accent text-on-accent"
              : "bg-coral text-on-coral"
            : "text-muted hover:bg-ink/5 hover:text-ink"
        }`}
      >
        {/* Selected = filled shape; unselected = outline (not color alone). */}
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${up ? "" : "rotate-180"}`}
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5l8 13H4z" />
        </svg>
      </button>
    </form>
  );
}
