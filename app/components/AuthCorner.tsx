import { getAuthUser, isClerkConfigured } from "../server/auth";

type Props = {
  currentPath: string;
};

export async function AuthCorner({ currentPath }: Props) {
  const user = await getAuthUser();

  if (!user) {
    if (!isClerkConfigured()) {
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
        <a className="auth-button" href={`/sign-in?redirect_url=${encodeURIComponent(currentPath)}`}>
          Войти в портал
        </a>
      </div>
    );
  }

  const callbackUrl = encodeURIComponent(currentPath);

  return (
    <div className="auth-corner signed-in">
      <span className="auth-user">
        {user.imageUrl ? <img src={user.imageUrl} alt="" className="auth-avatar" /> : null}
        <span>{user.name}</span>
      </span>
      {user.isAdmin ? (
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
