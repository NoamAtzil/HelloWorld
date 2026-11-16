"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

type NavItem = { href: string; label: string; icon: IconName };

const SIGNED_IN: NavItem[] = [
  { href: "/studio", label: "Studio", icon: "spark" },
  { href: "/arena", label: "Arena", icon: "duel" },
  { href: "/drop", label: "Daily Drop", icon: "calendar" },
  { href: "/hall", label: "Hall of Fame", icon: "trophy" },
  { href: "/feed", label: "Feed", icon: "gallery" },
  { href: "/dashboard", label: "My captions", icon: "quote" },
  { href: "/profile", label: "Profile", icon: "user" },
];

const SIGNED_OUT: NavItem[] = [
  { href: "/", label: "Studio", icon: "spark" },
  { href: "/arena", label: "Arena", icon: "duel" },
  { href: "/drop", label: "Daily Drop", icon: "calendar" },
  { href: "/hall", label: "Hall of Fame", icon: "trophy" },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const links = signedIn ? SIGNED_IN : SIGNED_OUT;
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {links.map(({ href, label, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active ? "bg-tint font-semibold text-accent-text shadow-[inset_0_0_0_1px_var(--line)]" : "font-medium text-muted hover:bg-tint/60 hover:text-ink"
            }`}
          >
            <Icon name={icon} className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
