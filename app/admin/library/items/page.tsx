import { redirect } from "next/navigation";
import { AdminNav } from "../../admin-nav";
import { LibraryItemsClient } from "./library-items-client";
import { getAuthUser, isGoogleAuthConfigured } from "../../../server/auth";
import { getDatabaseUrlStatus } from "../../../server/db";
import { listLibraryItems, type LibraryItem } from "../../../server/library-items";

export const dynamic = "force-dynamic";

export default async function AdminLibraryItemsPage() {
  if (!isGoogleAuthConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <h1>Библиотека предметов</h1>
          <p>Google-вход ещё не настроен: добавь OAuth-ключи и AUTH_SECRET.</p>
        </section>
      </main>
    );
  }

  const user = await getAuthUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin/library/items");
  }

  const authUser = user;
  const isAdmin = user.isAdmin;

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Библиотека предметов</h1>
          <p>
            Эта страница доступна только администраторам сайта.
          </p>
        </section>
      </main>
    );
  }

  const databaseReady = getDatabaseUrlStatus().configured;
  let items: LibraryItem[] = [];

  if (databaseReady) {
    try {
      items = await listLibraryItems();
    } catch {
      items = [];
    }
  }

  return (
    <main className="admin-page">
      <AdminNav active="library-items" />
      <LibraryItemsClient initialItems={items} databaseReady={databaseReady} />
    </main>
  );
}
