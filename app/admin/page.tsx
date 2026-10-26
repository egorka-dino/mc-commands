import { redirect } from "next/navigation";
import { getAuthUser, isGoogleAuthConfigured } from "../server/auth";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isGoogleAuthConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <h1>Админка</h1>
          <p>Google-вход ещё не настроен: добавь OAuth-ключи и AUTH_SECRET.</p>
        </section>
      </main>
    );
  }

  const user = await getAuthUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const authUser = user;
  const isAdmin = user.isAdmin;

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Админка</h1>
          <p>
            Эта страница доступна только администраторам сайта.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminNav />
    </main>
  );
}
