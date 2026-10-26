// Shapes shared by the Studio's server actions and its client component.
export type TakesResult =
  | { ok: true; takes: string[]; remaining: number }
  | { ok: false; error: string; needsLogin?: boolean };

export type RemixResult =
  | { ok: true; caption: string; remaining: number }
  | { ok: false; error: string; needsLogin?: boolean };

export type PublishResult =
  | { ok: true; id: number; shared: boolean; drop: boolean }
  | { ok: false; error: string; needsLogin?: boolean };
