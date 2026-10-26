import { redirect } from "next/navigation";
import { getSafeRedirectUrl } from "../../server/auth-policy";
export default async function AuthCompletePage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(getSafeRedirectUrl(params?.redirect_url));
}
