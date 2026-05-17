import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkConfigured =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

export default clerkConfigured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    "/admin(.*)",
    "/api/admin(.*)",
    "/api/auth/status",
    "/auth/complete(.*)",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/sign-out(.*)",
  ],
};
