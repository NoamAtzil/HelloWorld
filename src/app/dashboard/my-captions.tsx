"use client";

import { NoticeToast, usePostActions } from "@/components/use-post-actions";
import { PostCard } from "@/components/post-card";
import type { FeedPost } from "@/app/feed/sort";

export type MyItem = { post: FeedPost; record: string };

export function MyCaptions({ items }: { items: MyItem[] }) {
  const actions = usePostActions(items.map((i) => i.post));
  const records = new Map(items.map((i) => [i.post.id, i.record]));
  return (
    <>
      <ul className="flex flex-col gap-12">
        {actions.posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} onVote={actions.castVote} onDelete={actions.removePost} showAuthor={false} extra={records.get(post.id)} />
          </li>
        ))}
      </ul>
      <NoticeToast notice={actions.notice} onDismiss={actions.dismissNotice} />
    </>
  );
}
