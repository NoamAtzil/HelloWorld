import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Guide } from "@/components/guide";
import { arenaGuidance } from "@/lib/guidance";
import { ArenaClient } from "./arena-client";
import { loadArenaPair } from "./pair";

export const metadata: Metadata = {
  title: "Arena — caption",
  description: "Two captions, one photo. Pick the funnier one.",
};

export default async function ArenaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      {data?.claims ? (
        <ArenaClientLoader />
      ) : (
        <div className="stage">
          <div className="stage-beam" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 p-6 sm:p-10">
            <Guide guidance={arenaGuidance({ phase: "signed-out" })} eyebrow="The Arena" size="lg" as="h1" />
            <p className="max-w-lg text-ink-2">Judge head-to-head caption battles and help crown the funniest captions. It&apos;s free.</p>
            <Link href="/login?next=%2Farena" className="btn-primary btn-lg press self-start">
              Sign in with Google
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

async function ArenaClientLoader() {
  const supabase = await createClient();
  const { pair, error } = await loadArenaPair(supabase);
  return <ArenaClient initialPair={pair} loadFailed={!!error} />;
}
