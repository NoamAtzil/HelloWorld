"use client";

import { useState } from "react";
import { formatDropDate } from "@/lib/drop";
import { downloadCard } from "@/lib/share-card";
import { Icon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { voiceLabel } from "@/lib/voices";
import type { FeedPost } from "@/app/feed/sort";

type VoteHandler = (id: number, value: 1 | -1, formData: FormData) => Promise<void>;
type DeleteHandler = (id: number, formData: FormData) => Promise<void>;

export function PostCard({
  post,
  onVote,
  onDelete,
  showAuthor = true,
  extra,
}: {
  post: FeedPost;
  onVote: VoteHandler;
  onDelete?: DeleteHandler;
  showAuthor?: boolean;
  /** An extra line under the caption, e.g. the Arena record. */
  extra?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Your own Daily Drop entry can't be voted on (the database enforces it).
  const voteLocked = post.mine && !!post.dropDate;
  const voice = voiceLabel(post.voice);

  async function saveCard() {
    if (!post.imageUrl || working) return;
    setWorking(true);
    setStatus(null);
    try {
      await downloadCard(post.imageUrl, post.content);
    } catch {
      setStatus("Couldn't make the card. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${post.id}`);
      setStatus("Link copied!");
    } catch {
      setStatus("Couldn't copy the link.");
    }
    setTimeout(() => setStatus(null), 2200);
  }

  return (
    <article id={`post-${post.id}`} tabIndex={-1} className="panel lift scroll-mt-24 overflow-hidden !rounded-[1.6rem] outline-none">
      {/* PHOTO: reality, the hero. Exact corners. */}
      <Photo src={post.imageUrl} alt={post.content} size="feed" className="!rounded-none !shadow-none">
        {onDelete &&
          post.mine &&
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
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ))}
      </Photo>

      {/* CAPTION: the AI's twist, set in the display serif on a straight plate. */}
      <div className="plate-glass relative z-[1] mx-3 -mt-10 px-5 pb-5 pt-4">
        <p className="caption-text text-[1.35rem] text-ink sm:text-2xl">{post.content}</p>
      </div>

      {/* REACTION: precise controls. */}
      <div className="mt-3 flex items-center justify-between gap-3 px-4">
        <div
          role="group"
          aria-label="Vote on this caption"
          className="inline-flex shrink-0 items-center rounded-full bg-sunken p-1 ring-1 ring-line"
        >
          <VoteButton post={post} value={1} onVote={onVote} disabled={voteLocked} />
          <span
            aria-live="polite"
            aria-label={`Score ${post.score}`}
            className={`min-w-10 text-center text-base font-semibold tabular-nums ${
              post.myVote === 1 ? "text-accent-text" : post.myVote === -1 ? "text-coral-text" : "text-ink"
            }`}
          >
            {post.score}
          </span>
          <VoteButton post={post} value={-1} onVote={onVote} disabled={voteLocked} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void saveCard()}
            disabled={!post.imageUrl || working}
            className="btn-ghost btn-sm"
            title="Download a shareable card"
          >
            <Icon name="photo" className="h-3.5 w-3.5" /> {working ? "…" : "Card"}
          </button>
          {post.isPublic && (
            <button type="button" onClick={() => void copyLink()} className="btn-ghost btn-sm">
              <Icon name="copy" className="h-3.5 w-3.5" /> Link
            </button>
          )}
        </div>
      </div>

      {(voice || post.dropDate || post.isPublic || (showAuthor && post.author && !post.mine)) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-5 text-xs">
          {voice && <span className="chip whitespace-nowrap">{voice}</span>}
          {post.dropDate && (
            <span className="chip whitespace-nowrap">
              <Icon name="calendar" className="h-3 w-3" /> Daily Drop · {formatDropDate(post.dropDate).split(",")[1]?.trim() ?? post.dropDate}
            </span>
          )}
          {post.isPublic && <span className="chip chip-mute whitespace-nowrap">Shared publicly</span>}
          {showAuthor && post.author && !post.mine && <span className="text-muted">by {post.author}</span>}
        </div>
      )}
      {extra && <p className="mt-2 px-5 text-sm font-medium text-ink">{extra}</p>}
      {post.direction && (
        <p className="mt-2 truncate px-5 text-sm text-muted">Direction: {post.direction}</p>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
      {status && <p aria-hidden="true" className="mt-1 px-5 text-sm font-medium text-accent-text">{status}</p>}
      <div className="h-4" aria-hidden="true" />
    </article>
  );
}

function VoteButton({
  post,
  value,
  onVote,
  disabled,
}: {
  post: FeedPost;
  value: 1 | -1;
  onVote: VoteHandler;
  disabled?: boolean;
}) {
  const up = value === 1;
  const active = post.myVote === value;
  return (
    <form action={(formData) => onVote(post.id, value, formData)}>
      <input type="hidden" name="generation_id" value={post.id} />
      <input type="hidden" name="value" value={value} />
      <button
        type="submit"
        disabled={disabled}
        aria-pressed={active}
        aria-label={up ? "Upvote" : "Downvote"}
        title={disabled ? "You can't vote on your own Drop entry" : undefined}
        className={`vote press grid h-11 w-12 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${
          active
            ? up
              ? "bg-gradient-to-b from-[var(--btn-from)] to-accent text-on-accent shadow-[var(--shadow-glow)]"
              : "bg-coral text-on-coral"
            : "text-muted hover:bg-tint hover:text-accent-text"
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
