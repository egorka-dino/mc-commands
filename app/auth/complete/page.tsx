import { ClerkProvider } from "@clerk/nextjs";
import { clerkLocalization } from "../../components/clerk-localization";
import { AuthCompleteClient } from "./AuthCompleteClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSafeRedirectUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue?.startsWith("/") || rawValue.startsWith("//")) {
    return "/";
  }

  return rawValue;
}

export default async function AuthCompletePage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params?.redirect_url);

  return (
    <ClerkProvider localization={clerkLocalization}>
      <AuthCompleteClient redirectUrl={redirectUrl} />
    </ClerkProvider>
  );
}
