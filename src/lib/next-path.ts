// Only same-site paths may be used as a post-login destination (no open
// redirects): must start with a single "/" and contain no backslash or scheme.
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value.length <= 200 ? value : null;
}

export const POST_LOGIN_COOKIE = "post_login";
