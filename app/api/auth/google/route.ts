import { getSafeRedirectUrl } from "../../../server/auth-policy";
export function GET(request: Request) {
  const url = new URL(request.url);
  const signInUrl = new URL("/sign-in", url);
  signInUrl.searchParams.set("redirect_url", getSafeRedirectUrl(url.searchParams.get("callbackUrl")));
  return Response.redirect(signInUrl);
}
