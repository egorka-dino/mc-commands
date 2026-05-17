import type { ExarotonServersResult } from "../server/exaroton";

type Props = {
  exaroton: ExarotonServersResult;
};

export function ExarotonServersPanel({ exaroton }: Props) {
  return (
    <section className="admin-panel admin-exaroton" aria-label="Серверы Exaroton">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">Exaroton</p>
          <h2>Серверы и игроки онлайн</h2>
        </div>
        {exaroton.fetchedAt ? (
          <span className="admin-timestamp">
            Обновлено {new Date(exaroton.fetchedAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

      {!exaroton.configured ? (
        <p className="admin-warning">
          Добавь <code>EXAROTON_API_KEY</code> в окружение, чтобы видеть серверы.
        </p>
      ) : !exaroton.ok ? (
        <p className="admin-warning">Не удалось получить серверы Exaroton: {exaroton.error}</p>
      ) : exaroton.servers.length ? (
        <div className="admin-server-grid">
          {exaroton.servers.map((server) => (
            <article className="admin-server-card" key={server.id}>
              <div className="admin-server-head">
                <div>
                  <h3>{server.name}</h3>
                  <p>{server.address || server.id}</p>
                </div>
                <span className={`admin-server-status ${server.statusTone}`}>
                  {server.statusLabel}
                </span>
              </div>

              <dl className="admin-server-meta">
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

              <div className="admin-player-list" aria-label={`Игроки на ${server.name}`}>
                {server.players.list.length ? (
                  server.players.list.map((player) => <span key={player}>{player}</span>)
                ) : server.players.count > 0 && !server.players.listAvailable ? (
                  <em>Онлайн {server.players.count}, список игроков не отдан API</em>
                ) : (
                  <em>Сейчас никого нет</em>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-warning">У API-ключа пока нет доступных серверов.</p>
      )}
    </section>
  );
}
