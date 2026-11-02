import type {} from "./auth-types";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { encode } from "next-auth/jwt";
import {
  AUTOMATION_SESSION_SECONDS, automationKeyVersion, validAutomationIdentity, verifyAutomationKey,
  type AutomationRole,
} from "./automation-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ checks: ["pkce", "state", "nonce"] }),
    Credentials({
      id: "automation",
      name: "Сервисный доступ",
      credentials: { key: { type: "password" }, role: { type: "text" } },
      authorize(credentials) {
        if (!verifyAutomationKey(credentials.key)) return null;
        if (credentials.role !== "member" && credentials.role !== "admin") return null;
        return {
          id: `automation:${credentials.role}`,
          name: credentials.role === "admin" ? "Codex (администратор)" : "Codex (пользователь)",
          authType: "automation" as const,
          automationRole: credentials.role,
          automationExpiresAt: Math.floor(Date.now() / 1000) + AUTOMATION_SESSION_SECONDS,
          automationKeyVersion: automationKeyVersion(),
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  jwt: {
    encode(params) {
      return encode({ ...params, maxAge: params.token?.authType === "automation" ? AUTOMATION_SESSION_SECONDS : params.maxAge });
    },
  },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    signIn({ account, profile, user }) {
      if (account?.provider === "automation") {
        return user.authType === "automation" && user.id === `automation:${user.automationRole}` && validAutomationIdentity(user);
      }
      return account?.provider === "google" && profile?.email_verified === true && Boolean(profile.sub && profile.email);
    },
    jwt({ token, account, profile, user }) {
      if (account?.provider === "automation") {
        token.authType = "automation";
        token.automationRole = user.automationRole;
        token.automationExpiresAt = user.automationExpiresAt;
        token.automationKeyVersion = user.automationKeyVersion;
        delete token.googleId;
        delete token.email;
        delete token.picture;
      }
      if (account?.provider === "google" && profile?.email_verified === true) {
        token.googleId = profile.sub;
        delete token.authType;
        delete token.automationRole;
        delete token.automationExpiresAt;
        delete token.automationKeyVersion;
      }
      if (token.authType === "automation" && !validAutomationIdentity(token)) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.authType === "automation") {
        session.user.id = `automation:${token.automationRole}`;
        session.user.authType = "automation";
        session.user.automationRole = token.automationRole as AutomationRole;
        session.user.automationExpiresAt = token.automationExpiresAt as number;
        session.user.automationKeyVersion = token.automationKeyVersion as string;
        session.expires = new Date((token.automationExpiresAt as number) * 1000).toISOString() as typeof session.expires;
      } else if (session.user && typeof token.googleId === "string") session.user.id = token.googleId;
      return session;
    },
  },
});
