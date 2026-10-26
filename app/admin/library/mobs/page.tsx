import { redirect } from "next/navigation";
import { AdminNav } from "../../admin-nav";
import { LibraryMobsClient } from "./library-mobs-client";
import { getAuthUser, isGoogleAuthConfigured } from "../../../server/auth";
import { getDatabaseUrlStatus } from "../../../server/db";
import { listLibraryMobs, type LibraryMob } from "../../../server/library-mobs";

export const dynamic = "force-dynamic";

export default async function AdminLibraryMobsPage() {
  if (!isGoogleAuthConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <h1>Библиотека мобов</h1>
          <p>Google-вход ещё не настроен: добавь OAuth-ключи и AUTH_SECRET.</p>
        </section>
      </main>
    );
  }

  const user = await getAuthUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin/library/mobs");
  }

  const authUser = user;
  const isAdmin = user.isAdmin;

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Библиотека мобов</h1>
          <p>
            Эта страница доступна только администраторам сайта.
          </p>
        </section>
      </main>
    );
  }

  const databaseReady = getDatabaseUrlStatus().configured;
  let mobs: LibraryMob[] = [];

  if (databaseReady) {
    try {
      mobs = await listLibraryMobs({ admin: true });
    } catch {
      mobs = [];
    }
  }

  return (
    <main className="admin-page">
      <AdminNav active="library-mobs" />
      <LibraryMobsClient initialMobs={mobs} databaseReady={databaseReady} />
    </main>
  );
}
