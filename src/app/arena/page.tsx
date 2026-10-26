import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SignInGate } from "@/components/sign-in-gate";
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-24 pt-6">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">The Arena</h1>
        <p className="mt-1 text-sm text-muted">
          Two captions, one photo. Tap the funnier one, then see who wrote what.
        </p>
      </div>
      {data?.claims ? (
        <ArenaClientLoader />
      ) : (
        <SignInGate title="Step into the Arena" next="/arena">
          Judge head-to-head caption battles and help crown the funniest captions. It&apos;s free.
        </SignInGate>
      )}
    </main>
  );
}

async function ArenaClientLoader() {
  const supabase = await createClient();
  const { pair, error } = await loadArenaPair(supabase);
  return <ArenaClient initialPair={pair} loadFailed={!!error} />;
}
