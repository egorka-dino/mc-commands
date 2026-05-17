"use client";

import { useEffect, useState } from "react";

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
  const callbackUrl = encodeURIComponent(currentPath);

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
  }, []);

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
        <a className="auth-link" href={`/sign-out?redirect_url=${callbackUrl}`}>
          Выйти
        </a>
      </div>
    );
  }

  if (status?.configured === false) {
    return (
      <div className="auth-corner">
        <span className="auth-text">
          Clerk-вход почти готов: осталось заполнить ключи проекта.
        </span>
      </div>
    );
  }

  return (
    <div className="auth-corner">
      <a className="auth-button" href={`/sign-in?redirect_url=${callbackUrl}`}>
        Войти в портал
      </a>
    </div>
  );
}
