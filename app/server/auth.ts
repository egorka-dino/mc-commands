import { auth } from "./google-auth";
import { getAppUserId, isAdminEmail, isGoogleAuthConfigured } from "./auth-policy";

export { isGoogleAuthConfigured } from "./auth-policy";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  isAdmin: boolean;
} | null;

export async function getAuthUser(): Promise<AuthUser> {
  if (!isGoogleAuthConfigured()) return null;
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return {
    id: getAppUserId(user.id),
    name: user.name || user.email || "Игрок",
    email: user.email,
    imageUrl: user.image || null,
    isAdmin: isAdminEmail(user.email),
  };
}
