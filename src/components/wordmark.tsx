import Link from "next/link";

// Working wordmark only; the real product name is still undecided. Change the
// three parts below (the middle one is the single stretched letter).
const BRAND = { before: "capti", bent: "o", after: "n" };

export function Wordmark() {
  return (
    <Link href="/" aria-label={`${BRAND.before}${BRAND.bent}${BRAND.after} home`} className="flex shrink-0 items-center">
      <span className="font-brand text-xl font-bold tracking-tight">
        {BRAND.before}
        <span aria-hidden="true" className="mx-[0.1em] inline-block text-accent-text" style={{ transform: "scaleX(1.6) skewX(-6deg)", transformOrigin: "50% 85%" }}>
          {BRAND.bent}
        </span>
        {BRAND.after}
      </span>
    </Link>
  );
}
