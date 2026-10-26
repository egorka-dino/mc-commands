import { redirect } from "next/navigation";
import { getSafeRedirectUrl } from "../server/auth-policy";

// Compatibility for old links. Only the CSRF-protected POST button ends a session.
export default async function SignOutPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const path = getSafeRedirectUrl(params?.redirect_url);
  redirect(path.startsWith("/sign-out") ? "/" : path);
}
