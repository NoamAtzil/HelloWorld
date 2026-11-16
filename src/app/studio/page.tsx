import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Studio } from "@/components/studio";

export const metadata: Metadata = {
  title: "Studio",
  description: "Pick a photo and a voice, get three captions, remix, and publish your favorite.",
};

export default async function StudioPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Studio signedIn={!!data?.claims} heading="The Studio" />
    </main>
  );
}
