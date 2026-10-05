import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import { Wordmark } from "@/components/wordmark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "caption — photos in, funny captions out",
  description:
    "Upload a photo, get a funny AI caption, and let the feed vote on whether it landed.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-bg">
          <nav
            aria-label="Main"
            className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4"
          >
            <Wordmark />
            <NavLinks signedIn={!!claims} />
            {claims ? (
              <LogoutButton />
            ) : (
              <Link href="/login" className="btn-quiet shrink-0">
                Sign in
              </Link>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
