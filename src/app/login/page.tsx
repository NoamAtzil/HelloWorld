import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-path";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const next = safeNextPath(one((await props.searchParams).next));
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims) {
    redirect(next ?? "/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="flex flex-col items-center gap-6 glass rounded-3xl p-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted">
            Publish your captions, battle in the Arena, and enter the Daily Drop.
          </p>
        </div>
        <GoogleSignInButton next={next} />
      </div>
    </main>
  );
}
