import { redirect } from "next/navigation";
import { getAuthUser, isGoogleAuthConfigured } from "../../server/auth";
import { listExarotonServers } from "../../server/exaroton";
import { listExarotonServerPublications } from "../../server/exaroton-publications";
import { AdminNav } from "../admin-nav";
import { ExarotonServersPanel } from "../exaroton-servers-panel";

export const dynamic = "force-dynamic";

export default async function AdminServersPage() {
  if (!isGoogleAuthConfigured()) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <h1>Серверы</h1>
          <p>Google-вход ещё не настроен: добавь OAuth-ключи и AUTH_SECRET.</p>
        </section>
      </main>
    );
  }

  const user = await getAuthUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin/servers");
  }

  const authUser = user;
  const isAdmin = user.isAdmin;

  if (!isAdmin || !authUser) {
    return (
      <main className="admin-page">
        <section className="admin-panel">
          <p className="admin-kicker">Доступ закрыт</p>
          <h1>Серверы</h1>
          <p>
            Эта страница доступна только администраторам сайта.
          </p>
        </section>
      </main>
    );
  }

  const [exaroton, publicationSettings] = await Promise.all([
    listExarotonServers(),
    listExarotonServerPublications(),
  ]);

  return (
    <main className="admin-page">
      <AdminNav active="servers" />
      <ExarotonServersPanel exaroton={exaroton} publicationSettings={publicationSettings} />
    </main>
  );
}
