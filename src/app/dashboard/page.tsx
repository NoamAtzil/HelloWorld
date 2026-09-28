import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", claims.sub)
    .single();

  if (!profile?.first_name || !profile?.last_name) {
    redirect("/profile");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        Welcome, {profile.first_name}
      </h1>
      <p className="text-sm text-zinc-600">
        This is a protected page — it only renders for a signed-in user with
        a valid server-side session.
      </p>
      <LogoutButton />
    </main>
  );
}
