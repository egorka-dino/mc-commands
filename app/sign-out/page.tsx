"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get("redirect_url") || "/";

    void signOut({ redirectUrl });
  }, [signOut]);

  return <main className="auth-page">Выходим...</main>;
}
