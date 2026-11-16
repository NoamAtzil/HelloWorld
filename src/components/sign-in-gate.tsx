import Link from "next/link";
import { Guide } from "@/components/guide";

// Shown in place of a members-only page to visitors who aren't signed in. The
// Caption Creature explains what is waiting behind the sign-in.
export function SignInGate({
  title,
  children,
  next,
}: {
  title: string;
  children: React.ReactNode;
  next: string;
}) {
  return (
    <div className="stage">
      <div className="stage-beam" aria-hidden="true" />
      <div className="relative flex flex-col items-start gap-5 p-6 sm:p-10">
        <Guide guidance={{ mood: "curious", title, line: "Sign in with Google to come in." }} size="lg" />
        <p className="max-w-lg text-ink-2">{children}</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary btn-lg press">
          Sign in with Google
        </Link>
      </div>
    </div>
  );
}
