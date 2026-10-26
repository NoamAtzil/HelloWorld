"use client";

import { NoticeToast, usePostActions } from "@/components/use-post-actions";
import { PostCard } from "@/components/post-card";
import { sortPosts, type FeedPost } from "@/app/feed/sort";

export function DropEntries({ posts }: { posts: FeedPost[] }) {
  const actions = usePostActions(posts);
  // Live ranking from real votes; ties go to the earlier entry.
  const ranked = sortPosts(actions.posts, "top").sort(
    (a, b) => b.score - a.score || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  return (
    <>
      <ol className="flex flex-col gap-12">
        {ranked.map((post, index) => (
          <li key={post.id} className="flex flex-col gap-2">
            <p className="px-1 text-sm font-semibold text-accent-text">
              {post.score > 0 && index === 0 ? "Leading right now" : `#${index + 1}`}
            </p>
            <PostCard post={post} onVote={actions.castVote} onDelete={actions.removePost} />
          </li>
        ))}
      </ol>
      <NoticeToast notice={actions.notice} onDismiss={actions.dismissNotice} />
    </>
  );
}
