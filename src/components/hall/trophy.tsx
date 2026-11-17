import { useId } from "react";

// A small gold trophy with a slow, subtle shine, and a gold crown. Plain SVG.
export function Trophy({ className = "" }: { className?: string }) {
  const u = `tr${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".35" stopColor="#f8dc8a" />
          <stop offset=".7" stopColor="#d9a62a" />
          <stop offset="1" stopColor="#9b6b12" />
        </linearGradient>
        <clipPath id={`${u}c`}>
          <path d="M26 10H74V42C74 62 61 74 50 77C39 74 26 62 26 42Z" />
        </clipPath>
      </defs>
      <path d="M26 22H12C12 42 21 51 33 53" fill="none" stroke={`url(#${u}g)`} strokeWidth="6" strokeLinecap="round" />
      <path d="M74 22H88C88 42 79 51 67 53" fill="none" stroke={`url(#${u}g)`} strokeWidth="6" strokeLinecap="round" />
      <path d="M26 10H74V42C74 62 61 74 50 77C39 74 26 62 26 42Z" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="44" y="76" width="12" height="16" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2" />
      <path d="M32 94H68L72 104H28Z" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="24" y="104" width="52" height="9" rx="2.5" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2.2" />
      <g clipPath={`url(#${u}c)`}>
        <rect className="trophy-shine" x="-40" y="0" width="26" height="90" fill="#fff" opacity=".6" transform="skewX(-18)" />
      </g>
      <path d="M36 18C36 38 40 56 50 66" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function Crown({ className = "" }: { className?: string }) {
  const u = `cw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 100 64" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset=".45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#a8741a" />
        </linearGradient>
      </defs>
      <path d="M8 54L13 16L36 36L50 6L64 36L87 16L92 54Z" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="8" y="50" width="84" height="9" rx="3" fill={`url(#${u}g)`} stroke="#7a4f0a" strokeWidth="2.4" />
      <circle cx="13" cy="14" r="4.6" fill="#ff5a7a" stroke="#7a4f0a" strokeWidth="1.8" />
      <circle cx="50" cy="5" r="5" fill="#5b6cff" stroke="#7a4f0a" strokeWidth="1.8" />
      <circle cx="87" cy="14" r="4.6" fill="#2ec4a6" stroke="#7a4f0a" strokeWidth="1.8" />
      <circle cx="50" cy="54.5" r="2.6" fill="#fff3c4" />
      <circle cx="30" cy="54.5" r="2" fill="#fff3c4" />
      <circle cx="70" cy="54.5" r="2" fill="#fff3c4" />
    </svg>
  );
}
