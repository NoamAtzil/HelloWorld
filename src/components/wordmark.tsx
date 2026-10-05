import Link from "next/link";

// Working wordmark only; the real product name is still undecided. Change the
// three parts below (the middle one is the single stretched letter).
const BRAND = { before: "capti", bent: "o", after: "n" };

export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label={`${BRAND.before}${BRAND.bent}${BRAND.after} home`}
      className="shrink-0 text-xl font-semibold tracking-tight text-ink"
    >
      {BRAND.before}
      <span className="wordmark-bend" aria-hidden="true">
        {BRAND.bent}
      </span>
      {BRAND.after}
    </Link>
  );
}
