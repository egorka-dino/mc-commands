import { currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);
  const user = configured ? await currentUser() : null;

  return Response.json({
    provider: "clerk",
    configured,
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          name: user.fullName,
          email: user.primaryEmailAddress?.emailAddress,
          image: user.imageUrl,
        }
      : null,
  });
}
