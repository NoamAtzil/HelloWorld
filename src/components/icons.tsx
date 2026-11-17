// One small stroke-icon set, so every page speaks the same visual language.
const PATHS = {
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  wand: "M5 19 17 7M14 3.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1zM19 13l.7 1.3 1.3.7-1.3.7L19 17l-.7-1.3L17 15l1.3-.7z",
  quote: "M7 8h4v4a4 4 0 0 1-4 4M15 8h4v4a4 4 0 0 1-4 4",
  photo: "M4 6h16v12H4zM4 16l4-4 4 4 3-3 5 5M9 10h.01",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  library: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  play: "M8 5.5v13l11-6.5z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2",
  gallery: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  x: "M6 6l12 12M18 6 6 18",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
  retry: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  logout: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
  edit: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  duel: "M4 8h13l-3-3M20 16H7l3 3",
  close: "M6 6l12 12M18 6L6 18",
  volume: "M4 9h4l5-4v14l-5-4H4zM16.5 9.2a4 4 0 0 1 0 5.6M19 6.6a7.5 7.5 0 0 1 0 10.8",
  mute: "M4 9h4l5-4v14l-5-4H4zM17 9.5l4.5 5M21.5 9.5l-4.5 5",
  calendar: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4v3h-4z",
  user: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0",
  shuffle: "M4 7h3c5 0 5 10 10 10h3M4 17h3c1.6 0 2.6-.8 3.5-2M13.5 9C14.4 7.8 15.4 7 17 7h3M17 4l3 3-3 3M17 14l3 3-3 3",
  chain: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-4 w-4", strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "grip" ? 3 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
