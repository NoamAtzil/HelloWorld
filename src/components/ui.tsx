import Link from "next/link";
import { Creature } from "./creature";
import type { Mood } from "@/lib/mood";
import { Icon } from "./icons";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  back,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link href={back.href} className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent-text">
          <Icon name="arrow" className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-[2rem] leading-[1.06] sm:text-4xl lg:text-[2.7rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "warn" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "ok" ? "border-ok-text/20 bg-ok-tint text-ok-text" : "border-coral/25 bg-coral-tint text-coral-text"
      }`}
    >
      <Icon name={tone === "ok" ? "check" : "x"} className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, children, action, mood = "idle" }: { title: string; children?: React.ReactNode; action?: React.ReactNode; mood?: Mood }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="w-32" aria-hidden="true"><Creature mood={mood} /></div>
      <h2 className="mt-2 text-2xl">{title}</h2>
      {children && <p className="max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
