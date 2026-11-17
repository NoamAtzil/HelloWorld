"use client";

import { useEffect, useRef, useState } from "react";
import { Guide } from "@/components/guide";
import { NoticeToast, usePostActions, type VoteOutcome } from "@/components/use-post-actions";
import { PostCard } from "@/components/post-card";
import { sortPosts, type FeedPost } from "@/app/feed/sort";
import { CONFETTI_GOLD, fireConfetti } from "@/lib/confetti";
import { dropVoteGuidance, type Guidance } from "@/lib/guidance";
import { getAudio } from "@/lib/sound/engine";
import { useSound } from "@/lib/sound/use-sound";

const IDLE: Guidance = { mood: "curious", title: "Judges, take your seats", line: "Vote up what made you laugh. Every entry and every vote here is real." };

// The judging show: each entry stands on its own little podium under a lamp, a
// spotlight follows the entry you're looking at, and the host reacts to every real
// vote. Voting itself is exactly the existing flow (usePostActions -> setVote), so
// eligibility, the one-vote-per-entry rule and the tallies are unchanged.
export function DropEntries({ posts }: { posts: FeedPost[] }) {
  const audio = getAudio();
  useSound("drop"); // keeps the sound preference, unlock and loading in sync on this page
  const [active, setActive] = useState<number | null>(null);
  const [reaction, setReaction] = useState<Guidance | null>(null);
  const votes = useRef(0);
  const reset = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (reset.current) window.clearTimeout(reset.current);
    },
    [],
  );

  function onVote({ id, next, ok }: VoteOutcome) {
    const n = votes.current++;
    if (reset.current) window.clearTimeout(reset.current);
    if (!ok) {
      setReaction(dropVoteGuidance("fail"));
    } else {
      setActive(id);
      setReaction(dropVoteGuidance(next === 1 ? "up" : next === -1 ? "down" : "undo", n));
      if (next === 1) {
        audio.play("d_vote");
        audio.play("d_applause", { gain: 0.5, delay: 0.06 });
        const btn = document.querySelector(`#post-${id} [aria-label="Vote on this caption"]`);
        const r = btn?.getBoundingClientRect();
        if (r) fireConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 26, angle: -90, spread: 110, speed: 520, colors: CONFETTI_GOLD, ttl: 1.6 });
      } else if (next === -1) {
        audio.play("d_vote", { rate: 0.78, gain: 0.8 });
      } else {
        audio.play("d_vote", { rate: 1.25, gain: 0.5 });
      }
    }
    reset.current = window.setTimeout(() => setReaction(null), 4500);
  }

  const actions = usePostActions(posts, { onVote });
  // Live ranking from real votes; ties go to the earlier entry.
  const ranked = sortPosts(actions.posts, "top").sort(
    (a, b) => b.score - a.score || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const spotlit = active ?? ranked[0]?.id ?? null;

  return (
    <>
      <div className="host-bar mb-5">
        <div className="panel p-3 sm:p-4" aria-live="polite">
          <Guide guidance={reaction ?? IDLE} eyebrow="Your host" size="sm" />
        </div>
      </div>
      <ol className="podiums flex flex-col gap-10" data-spot="on">
        {ranked.map((post, index) => {
          const medal = post.score > 0 && index < 3 ? (["", "two", "three"] as const)[index] : null;
          return (
            <li
              key={post.id}
              className="podium"
              data-active={spotlit === post.id}
              onPointerEnter={() => setActive(post.id)}
              onFocusCapture={() => setActive(post.id)}
            >
              <div className="podium-beam" aria-hidden="true" />
              <div className="podium-lamp" aria-hidden="true" />
              <p className="eyebrow podium-rank px-1">
                {medal !== null ? (
                  <>
                    <span className={`medal ${medal}`} aria-hidden="true">
                      {index + 1}
                    </span>
                    {index === 0 ? "Leading right now" : `In ${index === 1 ? "second" : "third"}`}
                  </>
                ) : (
                  `#${index + 1}`
                )}
              </p>
              <PostCard post={post} onVote={actions.castVote} onDelete={actions.removePost} />
              <div className="podium-base" aria-hidden="true" />
            </li>
          );
        })}
      </ol>
      <NoticeToast notice={actions.notice} onDismiss={actions.dismissNotice} />
    </>
  );
}
