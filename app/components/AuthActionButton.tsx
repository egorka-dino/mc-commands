"use client";

import { signIn, signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  action: "sign-in" | "sign-out";
  redirectUrl: string;
  autoStart?: boolean;
};

export function AuthActionButton({ action, redirectUrl, autoStart = false }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const running = useRef(false);
  const autoStarted = useRef(false);
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError(false);
    try {
      if (action === "sign-in") await signIn("google", { redirectTo: redirectUrl });
      else await signOut({ redirectTo: redirectUrl });
    } catch {
      running.current = false;
      setPending(false);
      setError(true);
    }
  }, [action, redirectUrl]);

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      void run();
    }
  }, [autoStart, run]);

  return (
    <span className="auth-action">
      <button type="button" className={action === "sign-in" ? "auth-button" : "auth-link"}
        disabled={pending} aria-busy={pending} onClick={() => void run()}>
        {pending ? (action === "sign-in" ? "Открываем Google..." : "Выходим...")
          : (action === "sign-in" ? "Войти через Google" : "Выйти")}
      </button>
      {error ? <span className="auth-action-error" role="alert">Не удалось выполнить действие. Попробуй ещё раз.</span> : null}
    </span>
  );
}
