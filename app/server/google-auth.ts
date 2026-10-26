import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ checks: ["pkce", "state", "nonce"] })],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true && Boolean(profile.sub && profile.email);
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email_verified === true) {
        token.googleId = profile.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.googleId === "string") session.user.id = token.googleId;
      return session;
    },
  },
});
