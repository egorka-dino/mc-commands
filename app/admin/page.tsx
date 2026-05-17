import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAuthUser, isAdminFromMetadata, isClerkConfigured } from "../server/auth";
import { getDatabaseUrlStatus } from "../server/db";
import { listSummonTemplates, type SummonTemplate } from "../server/summon-templates";
import { SummonTemplatesClient } from "./summon-templates-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <a className="admin-back" href="/">
            На главную
          </a>
          <h1>Админка</h1>
          <p>Clerk ещё не настроен: добавь ключи проекта, чтобы включить вход и роли.</p>
        </section>
      </main>
    );
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const authUser = await getAuthUser();
  const isAdmin = isAdminFromMetadata(user);

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <a className="admin-back" href="/">
            На главную
          </a>
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Админка</h1>
          <p>
            Эта страница доступна только пользователям с ролью <code>admin</code> в Clerk.
          </p>
        </section>
      </main>
    );
  }

  const databaseReady = getDatabaseUrlStatus().configured;
  let templates: SummonTemplate[] = [];

  if (databaseReady) {
    try {
      templates = await listSummonTemplates({ admin: true });
    } catch {
      templates = [];
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-panel admin-hero">
        <a className="admin-back" href="/">
          На главную
        </a>
        <p className="admin-kicker">Администратор</p>
        <h1>Админка mc-commands</h1>
        <p>
          Панель для служебных проверок и редактирования общих шаблонов мобов.
          Кнопка на сайте видна только пользователям с ролью <code>admin</code>.
        </p>
      </section>

      <section className="admin-grid" aria-label="Разделы админки">
        <article className="admin-card">
          <h2>Пользователь</h2>
          <dl>
            <div>
              <dt>Имя</dt>
              <dd>{authUser.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{authUser.email || "Не указан"}</dd>
            </div>
            <div>
              <dt>Clerk ID</dt>
              <dd>{authUser.id}</dd>
            </div>
          </dl>
        </article>

        <article className="admin-card">
          <h2>Проверки</h2>
          <div className="admin-actions">
            <a href="/api/health">API health</a>
            <a href="/api/db/health">Storage health</a>
            <a href="/api/auth/status">Auth status</a>
          </div>
        </article>

        <article className="admin-card">
          <h2>Страницы</h2>
          <div className="admin-actions">
            <a href="/admin/servers">Серверы Exaroton</a>
            <a href="/summon">Генератор /summon</a>
            <a href="/give">Генератор /give</a>
            <a href="/">Лендинг</a>
          </div>
        </article>
      </section>

      <SummonTemplatesClient initialTemplates={templates} databaseReady={databaseReady} />
    </main>
  );
}
