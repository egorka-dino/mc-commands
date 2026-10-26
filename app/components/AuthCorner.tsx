"use client";

import { useEffect, useState } from "react";
import { AuthActionButton } from "./AuthActionButton";

type Props = {
  currentPath: string;
};

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  user: {
    name: string;
    image: string | null;
    isAdmin: boolean;
  } | null;
};

export function AuthCorner({ currentPath }: Props) {
  const [status, setStatus] = useState<AuthStatus | null | undefined>(undefined);
  const returnPath = /^\/(?:admin|sign-in|sign-up|sign-out)(?:\/|$)/.test(currentPath) ? "/" : currentPath;

  useEffect(() => {
    let active = true;

    fetch("/api/auth/status", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AuthStatus | null) => {
        if (active) {
          setStatus(data);
        }
      })
      .catch(() => {
        if (active) {
          setStatus(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentPath]);

  if (status === undefined) {
    return <div className="auth-corner auth-corner-loading" aria-busy="true" />;
  }

  if (status?.authenticated && status.user) {
    return (
      <div className="auth-corner signed-in">
        <span className="auth-user">
          {status.user.image ? <img src={status.user.image} alt="" className="auth-avatar" /> : null}
          <span>{status.user.name}</span>
        </span>
        {status.user.isAdmin ? (
          <a className="auth-link admin-link" href="/admin">
            Админка
          </a>
        ) : null}
        <AuthActionButton action="sign-out" redirectUrl={returnPath} />
      </div>
    );
  }

  if (status?.configured === false) {
    return (
      <div className="auth-corner">
        <span className="auth-text">
          Вход через Google пока недоступен.
        </span>
      </div>
    );
  }

  return (
    <div className="auth-corner">
      <AuthActionButton action="sign-in" redirectUrl={returnPath} />
    </div>
  );
}
