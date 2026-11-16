import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-path";
import { Guide } from "@/components/guide";
import { LOGIN_GUIDANCE } from "@/lib/guidance";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <section className="stage" aria-labelledby="login-heading">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-6 p-6 sm:p-10">
          <Guide guidance={LOGIN_GUIDANCE} eyebrow="Sign in" id="login-heading" as="h1" size="lg" />
          <p className="text-ink-2">Publish your captions, battle in the Arena, and enter the Daily Drop.</p>
          <GoogleSignInButton next={next} />
        </div>
      </section>
    </main>
  );
}
