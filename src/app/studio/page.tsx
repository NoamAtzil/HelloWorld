import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Studio } from "@/components/studio";

export const metadata: Metadata = {
  title: "Studio — caption",
  description: "Pick a photo and a voice, get three captions, remix, and publish your favorite.",
};

export default async function StudioPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-24 pt-6">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">The Studio</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a photo and a voice. Get three takes, remix your favorite, then publish it.
        </p>
      </div>
      <Studio signedIn={!!data?.claims} />
    </main>
  );
}
