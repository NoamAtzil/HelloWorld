import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deletePost, setVote } from "./actions";
import { GenerateForm } from "./generate-form";

type FeedItem = {
  id: number;
  prompt: string;
  content: string;
  image_path: string;
  created_at: string;
  score: number;
  my_vote: number | null;
};

// Posts made without a custom direction store a generic default instruction;
// it isn't worth showing under every such post.
const GENERIC_INSTRUCTION = /^write a (funny )?caption for this photo\.?$/i;

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("feed_generations");
  const items = (data ?? []) as FeedItem[];

  // RLS limits this select to the caller's own posts, so these are the ones
  // that get a delete button.
  const { data: mine } = await supabase.from("generations").select("id");
  const myIds = new Set((mine ?? []).map((row) => row.id as number));

  // The bucket is private: sign one short-lived URL per image, in one call.
  const { data: signed } = await supabase.storage
    .from("post-images")
    .createSignedUrls(
      items.map((item) => item.image_path),
      60 * 60,
    );
  const imageUrls = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl] as const),
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pb-24 pt-6">
      <h1 className="sr-only">Feed</h1>
      <GenerateForm />

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-coral-tint px-4 py-3 text-sm text-coral-text"
        >
          Could not load the feed: {error.message}
        </p>
      )}

      <ul className="flex flex-col gap-12">
        {items.map((item) => {
          const imageUrl = imageUrls.get(item.image_path);
          const direction = GENERIC_INSTRUCTION.test(item.prompt.trim())
            ? null
            : item.prompt;
          return (
            <li key={item.id}>
              <article>
                {/* PHOTO: reality, the hero. Exact corners. */}
                <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={item.content}
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
                  {myIds.has(item.id) && (
                    <form action={deletePost} className="absolute right-3 top-3">
                      <input type="hidden" name="generation_id" value={item.id} />
                      <button
                        type="submit"
                        aria-label="Delete post"
                        title="Delete post"
                        className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/90 hover:bg-black/70 hover:text-white"
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
                    </form>
                  )}
                </div>

                {/* CAPTION: the AI's twist. The one permanent bend. */}
                <div className="bend-plate relative z-[1] mx-3 -mt-10 border border-glow/30 bg-tint px-5 pb-6 pt-4 pr-12 shadow-card">
                  <p className="text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
                    {item.content}
                  </p>
                </div>

                {/* REACTION: precise controls. */}
                <div className="mt-3 flex items-center gap-3 px-1">
                  <div
                    role="group"
                    aria-label="Vote on this caption"
                    className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface p-1"
                  >
                    <VoteButton
                      generationId={item.id}
                      value={1}
                      active={item.my_vote === 1}
                    />
                    <span
                      className={`min-w-10 text-center text-base font-semibold tabular-nums ${
                        item.my_vote === 1
                          ? "text-accent-text"
                          : item.my_vote === -1
                            ? "text-coral-text"
                            : "text-ink"
                      }`}
                      aria-label={`Score ${item.score}`}
                    >
                      {item.score}
                    </span>
                    <VoteButton
                      generationId={item.id}
                      value={-1}
                      active={item.my_vote === -1}
                    />
                  </div>
                  {direction && (
                    <p className="min-w-0 truncate text-sm text-muted">
                      Direction: {direction}
                    </p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {!error && items.length === 0 && (
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
    </main>
  );
}

function VoteButton({
  generationId,
  value,
  active,
}: {
  generationId: number;
  value: 1 | -1;
  active: boolean;
}) {
  const up = value === 1;
  return (
    <form action={setVote}>
      <input type="hidden" name="generation_id" value={generationId} />
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
