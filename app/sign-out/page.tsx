"use client";

import { ClerkProvider, useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { clerkLocalization } from "../components/clerk-localization";

function SignOutAction() {
  const { signOut } = useClerk();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get("redirect_url") || "/";

    void signOut({ redirectUrl });
  }, [signOut]);

  return <main className="auth-page">Выходим...</main>;
}

export default function SignOutPage() {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <SignOutAction />
    </ClerkProvider>
  );
}
