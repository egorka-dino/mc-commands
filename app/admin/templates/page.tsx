import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAuthUser, isAdminFromMetadata, isClerkConfigured } from "../../server/auth";
import { getDatabaseUrlStatus } from "../../server/db";
import { listSummonTemplates, type SummonTemplate } from "../../server/summon-templates";
import { AdminNav } from "../admin-nav";
import { SummonTemplatesClient } from "../summon-templates-client";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <h1>Шаблоны мобов</h1>
          <p>Clerk ещё не настроен: добавь ключи проекта, чтобы включить вход и роли.</p>
        </section>
      </main>
    );
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin/templates");
  }

  const authUser = await getAuthUser();
  const isAdmin = isAdminFromMetadata(user);

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Шаблоны мобов</h1>
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
      <AdminNav active="templates" />
      <SummonTemplatesClient initialTemplates={templates} databaseReady={databaseReady} />
    </main>
  );
}
