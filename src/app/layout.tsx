import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/account-menu";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The brand wordmark face.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
// Soft editorial serif for headlines and captions.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"], display: "swap" });

export const metadata: Metadata = {
  title: "caption — photos in, funny captions out",
  description:
    "Upload a photo, get a funny AI caption, and let the feed vote on whether it landed.",
};

// Runs before first paint: resolves the saved preference (light | dark |
// system) into data-theme so there is no flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("caption-theme");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : "";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="header-glass sticky top-0 z-30">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
            <Wordmark />
            <div className="no-scrollbar order-last -mx-1 w-full overflow-x-auto px-1 py-1 sm:order-none sm:mx-0 sm:w-auto sm:p-0">
              <NavLinks signedIn={!!claims} />
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <ThemeToggle />
              {claims ? (
                <AccountMenu email={email} />
              ) : (
                <Link href="/login" className="btn-primary btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
