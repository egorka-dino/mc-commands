export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  if (!configured) {
    return Response.json(
      {
        provider: "clerk",
        configured: false,
        message:
          "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY before enabling sign-in.",
      },
      { status: 503 },
    );
  }

  const callbackUrl = new URL(request.url).searchParams.get("callbackUrl") || "/";
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", callbackUrl);

  return Response.redirect(signInUrl);
}
