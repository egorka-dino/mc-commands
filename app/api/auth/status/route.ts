import { getAuthUser, isGoogleAuthConfigured } from "../../../server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isGoogleAuthConfigured();
  const user = await getAuthUser();

  return Response.json({
    provider: "google",
    configured,
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.imageUrl,
          isAdmin: user.isAdmin,
        }
      : null,
  }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}
