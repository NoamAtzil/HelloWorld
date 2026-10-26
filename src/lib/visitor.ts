import { createHash } from "node:crypto";

// Reduce an IP address to the unit we rate-limit on: the full address for
// IPv4, the /64 network for IPv6 (one household/device can rotate through
// billions of IPv6 addresses inside its /64).
export function ipBucket(ip: string): string {
  const value = ip.trim().toLowerCase();
  if (value.includes(":") && !value.includes(".")) {
    const [head, tail = ""] = value.split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const missing = Math.max(0, 8 - left.length - right.length);
    const groups = value.includes("::") ? [...left, ...Array(missing).fill("0"), ...right] : left;
    return groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(":") + "::/64";
  }
  return value;
}

// Which header carries the real client address depends on the host, and any
// other header is client-controlled (a visitor could send a fresh value on every
// request to get a fresh quota). So only the host's own header is trusted:
//   - Vercel:  x-vercel-forwarded-for (set by Vercel, overwrites client values)
//   - other:   the header named in TRUSTED_IP_HEADER (e.g. x-nf-client-connection-ip)
//   - local development only: x-forwarded-for / x-real-ip
// With none of these, every visitor shares one "unknown" bucket (strict, never
// spoofable).
export function clientIp(
  headers: { get(name: string): string | null },
  env: { VERCEL?: string; TRUSTED_IP_HEADER?: string; NODE_ENV?: string } = process.env,
): string | null {
  const names: string[] = [];
  if (env.VERCEL) names.push("x-vercel-forwarded-for");
  if (env.TRUSTED_IP_HEADER) names.push(env.TRUSTED_IP_HEADER.toLowerCase());
  if (env.NODE_ENV === "development") names.push("x-real-ip", "x-forwarded-for");
  for (const name of names) {
    const first = headers.get(name)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

// Stable, secret-salted identifier for a visitor. The raw IP is never stored.
export function visitorKey(ip: string | null, secret: string): string {
  const bucket = ip ? ipBucket(ip) : "unknown";
  return createHash("sha256").update(`${bucket}|${secret}`).digest("hex");
}
