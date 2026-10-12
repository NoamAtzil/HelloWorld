import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DemoPlayground } from "./demo-playground";

export const metadata: Metadata = {
  title: "Try the demo — caption",
  description: "See how a photo becomes a funny caption, no sign-in needed.",
};

// Public on purpose: no auth required, no database reads or writes, no AI.
export default async function DemoPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pb-24 pt-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-accent-text">Demo</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Pick a scene. Watch it become a joke.
        </h1>
        <p className="text-muted">
          Try the idea before you sign in. These are example Columbia-life
          scenes with pre-written sample captions.
        </p>
      </div>
      <DemoPlayground signedIn={!!data?.claims} />
    </main>
  );
}
