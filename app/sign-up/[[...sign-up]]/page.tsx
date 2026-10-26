import { redirect } from "next/navigation";
import { getSafeRedirectUrl } from "../../server/auth-policy";
export default async function SignUpPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(`/sign-in?redirect_url=${encodeURIComponent(getSafeRedirectUrl(params?.redirect_url))}`);
}
