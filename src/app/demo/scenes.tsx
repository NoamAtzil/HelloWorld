// Shared by the guest demo and the landing page. Nothing here calls an AI
// model or touches the database.
// Predefined Columbia-life example scenes (drawn as SVG, so there is nothing
// to upload or store) with a hand-written sample caption each. Colors are
// fixed hex values so the scenes look the same in light and dark mode.
export const SCENES = [
  {
    label: "Butler at 3 AM",
    caption: "Butler at 3 AM during finals: “one more chapter” is a cry for help.",
    art: (
      <>
        <rect width="400" height="300" fill="#241a14" />
        <circle cx="338" cy="52" r="22" fill="#ffb066" />
        {[
          [40, 40], [90, 24], [150, 48], [215, 22], [262, 44], [372, 100], [24, 98],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="#f6ede4" opacity="0.7" />
        ))}
        <path d="M30 96 L200 54 L370 96Z" fill="#e8d7c3" />
        <rect x="40" y="96" width="320" height="14" fill="#d9c5ad" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={`w${i}`}
            x={90 + i * 50}
            y="112"
            width="22"
            height="122"
            fill="#ff9a3d"
            opacity={i === 2 ? 0.95 : i % 2 ? 0.35 : 0.75}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={`c${i}`} x={62 + i * 50} y="110" width="26" height="128" fill="#e8d7c3" />
        ))}
        <rect x="30" y="238" width="340" height="14" fill="#d9c5ad" />
        <rect x="20" y="252" width="360" height="14" fill="#c4ad92" />
        <text x="26" y="290" fill="#f6ede4" fontSize="18" fontWeight="700" fontFamily="system-ui, sans-serif">
          3:07 AM
        </text>
      </>
    ),
  },
  {
    label: "Core readings",
    caption: "Core Curriculum: where “light reading” weighs more than my backpack.",
    art: (
      <>
        <rect width="400" height="300" fill="#f4e3cf" />
        <rect y="262" width="400" height="38" fill="#6b4a2f" />
        {[
          { y: 226, h: 36, x: 78, w: 244, fill: "#c2410c", label: "THE REPUBLIC", tilt: 0 },
          { y: 192, h: 34, x: 98, w: 214, fill: "#7c2d12", label: "THE ILIAD", tilt: 0 },
          { y: 160, h: 32, x: 86, w: 230, fill: "#d97706", label: "CONFESSIONS", tilt: -1.5 },
          { y: 130, h: 30, x: 104, w: 196, fill: "#9a3412", label: "LEVIATHAN", tilt: 2.5 },
          { y: 102, h: 28, x: 92, w: 206, fill: "#b45309", label: "THE ODYSSEY", tilt: -3.5 },
        ].map((book) => (
          <g key={book.label} transform={`rotate(${book.tilt} 200 ${book.y + book.h})`}>
            <rect x={book.x} y={book.y} width={book.w} height={book.h} rx="3" fill={book.fill} />
            <text
              x={book.x + book.w / 2}
              y={book.y + book.h / 2 + 5}
              textAnchor="middle"
              fill="#fff7ed"
              fontSize="14"
              fontWeight="700"
              letterSpacing="2"
              fontFamily="system-ui, sans-serif"
            >
              {book.label}
            </text>
          </g>
        ))}
        <rect x="186" y="74" width="28" height="26" rx="5" fill="#ffffff" transform="rotate(-6 200 100)" />
        <path d="M214 80 q10 2 8 10 q-2 6 -10 6" fill="none" stroke="#ffffff" strokeWidth="4" transform="rotate(-6 200 100)" />
        <path d="M194 66 q4 -8 0 -14 M204 66 q4 -8 0 -14" fill="none" stroke="#c4ad92" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    label: "Subway delay",
    caption: "The 1 to Morningside Heights: “held momentarily” has outlasted my 9 AM.",
    art: (
      <>
        <rect width="400" height="300" fill="#2b2119" />
        <rect x="26" y="26" width="348" height="62" rx="8" fill="#0f0b08" stroke="#6b5b4e" strokeWidth="2" />
        <circle cx="62" cy="57" r="19" fill="#d94a3b" />
        <text x="62" y="65" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800" fontFamily="system-ui, sans-serif">
          1
        </text>
        <text x="92" y="64" fill="#fff7ed" fontSize="22" fontWeight="700" fontFamily="system-ui, sans-serif">
          116 St – Columbia University
        </text>
        <rect x="116" y="112" width="168" height="48" rx="6" fill="#000" />
        <text x="200" y="134" textAnchor="middle" fill="#fbbf24" fontSize="14" fontFamily="ui-monospace, monospace">
          NEXT TRAIN
        </text>
        <text x="200" y="152" textAnchor="middle" fill="#fbbf24" fontSize="17" fontWeight="700" fontFamily="ui-monospace, monospace">
          DELAYED
        </text>
        <rect y="222" width="400" height="78" fill="#4a382b" />
        <rect y="214" width="400" height="9" fill="#fbbf24" />
        <circle cx="318" cy="168" r="14" fill="#e9d8c8" />
        <rect x="302" y="184" width="32" height="38" rx="10" fill="#c2410c" />
        <rect x="292" y="190" width="14" height="30" rx="5" fill="#7c2d12" />
        <path d="M334 192 l14 -8" stroke="#e9d8c8" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
  },
];
