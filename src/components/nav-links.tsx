"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const links = signedIn
    ? [
        { href: "/feed", label: "Feed" },
        { href: "/books", label: "Books" },
        { href: "/dashboard", label: "Dashboard" },
        { href: "/profile", label: "Profile" },
      ]
    : [{ href: "/books", label: "Books" }];

  return (
    <ul className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm ${
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
