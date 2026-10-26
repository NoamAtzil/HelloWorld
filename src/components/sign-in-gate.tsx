import Link from "next/link";

// Shown in place of a members-only page to visitors who aren't signed in.
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
    <div className="glass glass-lit mx-auto flex max-w-md flex-col items-center gap-4 rounded-[28px] p-8 text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted">{children}</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary press">
        Sign in with Google
      </Link>
    </div>
  );
}
