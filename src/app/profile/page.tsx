import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
        <ProfileForm
          profile={
            profile ?? { first_name: null, last_name: null, avatar_url: null }
          }
        />
      </div>
    </main>
  );
}
