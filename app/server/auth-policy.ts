export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);
}

export function getSafeRedirectUrl(value: string | string[] | undefined | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\r\n]/.test(raw)) return "/";
  try {
    const url = new URL(raw, "https://local.invalid");
    return url.origin === "https://local.invalid" ? url.pathname + url.search + url.hash : "/";
  } catch { return "/"; }
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && (process.env.AUTH_ADMIN_EMAILS || "").split(",")
    .map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase()));
}

// Only an operator-controlled mapping may retain an old account's data ownership.
export function getAppUserId(googleId: string) {
  const mapping: unknown = JSON.parse(process.env.AUTH_LEGACY_USER_IDS || "{}");
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("Invalid AUTH_LEGACY_USER_IDS");
  const entries = Object.entries(mapping);
  const ids = new Set<string>();
  for (const [subject, id] of entries) {
    if (!subject || typeof id !== "string" || !id.startsWith("user_") || ids.has(id)) {
      throw new Error("Invalid or duplicate AUTH_LEGACY_USER_IDS entry");
    }
    ids.add(id);
  }
  const legacy = Object.prototype.hasOwnProperty.call(mapping, googleId) ? (mapping as Record<string, string>)[googleId] : null;
  return legacy || `google:${googleId}`;
}
