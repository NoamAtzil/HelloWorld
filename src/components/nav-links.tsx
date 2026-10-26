"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const links = signedIn
    ? [
        { href: "/studio", label: "Studio" },
        { href: "/arena", label: "Arena" },
        { href: "/drop", label: "Daily Drop" },
        { href: "/hall", label: "Hall of Fame" },
        { href: "/feed", label: "Feed" },
        { href: "/dashboard", label: "My captions" },
        { href: "/profile", label: "Profile" },
      ]
    : [
        { href: "/", label: "Studio" },
        { href: "/arena", label: "Arena" },
        { href: "/drop", label: "Daily Drop" },
        { href: "/hall", label: "Hall of Fame" },
      ];

  return (
    <ul className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-tint font-semibold text-accent-text"
                  : "font-medium text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
