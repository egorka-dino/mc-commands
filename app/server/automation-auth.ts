import { createHash, timingSafeEqual } from "node:crypto";

export const AUTOMATION_SESSION_SECONDS = 5 * 60;
export type AutomationRole = "member" | "admin";

export function automationEnabled() {
  return process.env.AUTOMATION_ACCESS_ENABLED === "true" &&
    (process.env.AUTOMATION_ACCESS_SECRET?.length ?? 0) >= 32 && Boolean(process.env.AUTH_SECRET);
}

function digest(value: string) {
  return createHash("sha256").update("mc-commands-automation-v1:").update(value).digest();
}

export function verifyAutomationKey(value: unknown) {
  if (!automationEnabled() || typeof value !== "string" || value.length > 512) return false;
  return timingSafeEqual(digest(value), digest(process.env.AUTOMATION_ACCESS_SECRET!));
}

export function automationKeyVersion() {
  return automationEnabled() ? digest(process.env.AUTOMATION_ACCESS_SECRET!).toString("hex") : undefined;
}

export function validAutomationIdentity(identity: {
  automationRole?: unknown;
  automationExpiresAt?: unknown;
  automationKeyVersion?: unknown;
}, now = Date.now()) {
  const expires = identity.automationExpiresAt;
  return automationEnabled() && (identity.automationRole === "member" || identity.automationRole === "admin") &&
    typeof expires === "number" && Number.isFinite(expires) &&
    expires > Math.floor(now / 1000) && expires <= Math.floor(now / 1000) + AUTOMATION_SESSION_SECONDS &&
    typeof identity.automationKeyVersion === "string" && identity.automationKeyVersion === automationKeyVersion();
}
