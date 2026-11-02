import { auth } from "./google-auth";
import { getAppUserId, isAdminEmail, isGoogleAuthConfigured } from "./auth-policy";

import { automationEnabled, validAutomationIdentity } from "./automation-auth";

export function isAuthConfigured() {
  return isGoogleAuthConfigured() || automationEnabled();
}

export { isGoogleAuthConfigured } from "./auth-policy";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  isAdmin: boolean;
} | null;

export async function getAuthUser(): Promise<AuthUser> {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  const user = session?.user;
  if (user?.authType === "automation") {
    if (!validAutomationIdentity(user) || user.id !== `automation:${user.automationRole}`) return null;
    return {
      id: user.id,
      name: user.automationRole === "admin" ? "Codex (администратор)" : "Codex (пользователь)",
      email: null,
      imageUrl: null,
      isAdmin: user.automationRole === "admin",
    };
  }
  if (!isGoogleAuthConfigured() || !user?.id || !user.email) return null;
  return {
    id: getAppUserId(user.id),
    name: user.name || user.email || "Игрок",
    email: user.email,
    imageUrl: user.image || null,
    isAdmin: isAdminEmail(user.email),
  };
}
