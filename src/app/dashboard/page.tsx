import Link from "next/link";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 shadow-card">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {profile.first_name}
        </h1>
        <p className="text-sm text-muted">
          This is a protected page — it only renders for a signed-in user with
          a valid server-side session.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/feed" className="btn-primary press">
            Open the feed
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
