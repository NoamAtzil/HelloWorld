import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SCENES } from "./demo/scenes";

// The landing page shows the first demo scene as a static example post.
const example = SCENES[0];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-12 px-4 pb-24 pt-10 sm:pt-16">
      <section className="flex flex-col gap-5">
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Drop a photo.
          <br />
          <span className="text-accent-text">Get the joke.</span>
        </h1>
        <p className="max-w-md text-lg text-muted">
          Upload a photo, get a funny AI caption, then let the feed vote on
          whether it landed.
        </p>
        <div className="flex flex-wrap gap-3">
          {signedIn ? (
            <Link href="/feed" className="btn-primary press">
              Open the feed
            </Link>
          ) : (
            <>
              <Link href="/demo" className="btn-primary press">
                Try the demo
              </Link>
              <Link href="/login" className="btn-quiet press">
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* A static example in the same shape as a real post. */}
      <section aria-label="Example post" className="flex flex-col gap-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted">
          Example
        </p>
        <div aria-hidden="true">
          <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card">
            <svg
              viewBox="0 0 400 300"
              preserveAspectRatio="xMidYMid slice"
              className="aspect-[4/3] w-full"
            >
              {example.art}
            </svg>
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div className="bend-plate relative z-[1] mx-3 -mt-10 border border-glow/30 bg-tint px-5 pb-6 pt-4 pr-12 shadow-card">
            <p className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {example.caption}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 border-t border-line pt-8">
        {[
          ["1", "Photo", "Your real picture, front and center."],
          ["2", "Caption", "AI writes the funny part."],
          ["3", "Vote", "The feed decides if it worked."],
        ].map(([n, title, text]) => (
          <div key={n} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-accent-text">{n}</span>
            <span className="font-semibold tracking-tight">{title}</span>
            <span className="text-sm text-muted">{text}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
