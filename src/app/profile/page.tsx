import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Guide } from "@/components/guide";
import { ONBOARDING_GUIDANCE } from "@/lib/guidance";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", claims.sub)
    .single();

  const incomplete = !profile?.first_name || !profile?.last_name;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {incomplete ? (
        <Guide guidance={ONBOARDING_GUIDANCE} eyebrow="Welcome" as="h1" size="lg" />
      ) : (
        <Guide guidance={{ mood: "idle", title: "Your profile", line: "This is how your name appears next to your captions." }} eyebrow="Account" as="h1" size="lg" />
      )}
      <div className="panel p-6 sm:p-8">
        <ProfileForm
          profile={
            profile ?? { first_name: null, last_name: null, avatar_url: null }
          }
        />
      </div>
    </main>
  );
}
