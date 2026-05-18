import { listPublishedExarotonServers } from "../server/exaroton-publications";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const communityServers = await listPublishedExarotonServers();

  return (
    <>
      <header>
        <h1>СЕРВЕРЫ</h1>
        <p>Minecraft-серверы сообщества, куда можно зайти поиграть</p>
      </header>

      <main>
        <section className="container landing-container">
          <div className="panel community-servers-panel">
            <h2>Серверы сообщества</h2>
            {communityServers.servers.length ? (
              <div className="community-server-grid">
                {communityServers.servers.map((server) => (
                  <article className="community-server-card" key={server.id}>
                    <div className="community-server-head">
                      <div>
                        <h3>{server.name}</h3>
                        <p>{server.address || server.id}</p>
                      </div>
                      <span className={`community-server-status ${server.statusTone}`}>
                        {server.statusLabel}
                      </span>
                    </div>
                    <dl className="community-server-meta">
                      <div>
                        <dt>Игроки</dt>
                        <dd>
                          {server.players.count}
                          {server.players.max !== null ? ` / ${server.players.max}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Версия</dt>
                        <dd>
                          {[server.software?.name, server.software?.version]
                            .filter(Boolean)
                            .join(" ") || "Не указана"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Пока нет доступных серверов. Загляни позже: здесь появятся серверы, куда можно
                зайти поиграть.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer>v1.0 · Minecraft Java Edition 1.21.5+</footer>
    </>
  );
}
