import { ClerkProvider, SignIn } from "@clerk/nextjs";
import { clerkLocalization } from "../../components/clerk-localization";

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

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params?.redirect_url);
  const completeUrl = `/auth/complete?redirect_url=${encodeURIComponent(redirectUrl)}`;

  return (
    <ClerkProvider localization={clerkLocalization}>
      <main className="auth-page">
        <SignIn
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl={completeUrl}
          forceRedirectUrl={completeUrl}
          oauthFlow="redirect"
        />
      </main>
    </ClerkProvider>
  );
}
