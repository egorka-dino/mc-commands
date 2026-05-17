"use client";

import { ClerkLoaded, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

type Props = {
  redirectUrl: string;
};

function AuthCompleteRedirect({ redirectUrl }: Props) {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      window.location.replace(redirectUrl);
    }
  }, [isLoaded, redirectUrl]);

  return <main className="auth-page">Завершаем вход...</main>;
}

export function AuthCompleteClient({ redirectUrl }: Props) {
  return (
    <ClerkLoaded>
      <AuthCompleteRedirect redirectUrl={redirectUrl} />
    </ClerkLoaded>
  );
}
