import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
        <div>
          <Link
            href={signedIn ? "/feed" : "/login"}
            className="btn-primary press"
          >
            {signedIn ? "Open the feed" : "Sign in to start"}
          </Link>
        </div>
      </section>

      {/* A static example in the same shape as a real post. */}
      <section aria-label="Example post" className="flex flex-col gap-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted">
          Example
        </p>
        <div aria-hidden="true">
          <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card">
            <div className="aspect-[4/3] bg-gradient-to-br from-tint-2 via-tint to-glow/40">
              <svg viewBox="0 0 400 300" className="h-full w-full" fill="none">
                <circle cx="290" cy="95" r="34" className="fill-glow/70" />
                <path
                  d="M0 240 L110 150 L190 215 L265 160 L400 250 V300 H0Z"
                  className="fill-accent/35"
                />
              </svg>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div className="bend-plate relative z-[1] mx-3 -mt-10 border border-glow/30 bg-tint px-5 pb-6 pt-4 pr-12 shadow-card">
            <p className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              Nature, but make it a screensaver.
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
