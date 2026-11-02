import { getAuthUser, isAuthConfigured } from "./auth";

export async function requireAdminResponse() {
  if (!isAuthConfigured()) {
    return Response.json({ ok: false, error: "Авторизация не настроена" }, { status: 503 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "Войдите в админку" }, { status: 401 });
  }

  if (!user.isAdmin) {
    return Response.json({ ok: false, error: "Доступно только администратору" }, { status: 403 });
  }

  return null;
}
