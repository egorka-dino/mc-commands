"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "give" | "summon";

type ExarotonServer = {
  id: string;
  name: string;
  address: string | null;
  status: number;
  statusLabel: string;
  statusTone: "online" | "busy" | "offline" | "error";
  players: {
    count: number;
    max: number | null;
    list: string[];
    listAvailable: boolean;
  };
};

type ServersResponse = {
  ok?: boolean;
  error?: string;
  exaroton?: {
    configured: boolean;
    ok: boolean;
    error?: string;
    servers: ExarotonServer[];
    fetchedAt: string | null;
  };
};

type Props = {
  mode: Mode;
  snapshot: unknown;
};

export function ServerCommandExecutor({ mode, snapshot }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [loadingServers, setLoadingServers] = useState(true);
  const [servers, setServers] = useState<ExarotonServer[]>([]);
  const [serverError, setServerError] = useState("");
  const [serverId, setServerId] = useState("");
  const [player, setPlayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadServers() {
      setLoadingServers(true);
      setServerError("");
      try {
        const response = await fetch("/api/admin/minecraft/servers", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as ServersResponse;

        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          setAuthorized(false);
          return;
        }

        setAuthorized(true);
        if (!response.ok || !data.exaroton?.ok) {
          setServerError(data.exaroton?.error || data.error || "Не удалось загрузить серверы Exaroton");
          setServers([]);
          return;
        }

        setServers(data.exaroton.servers.filter((server) => server.status === 1));
      } catch (error) {
        if (!cancelled) {
          setAuthorized(true);
          setServerError(error instanceof Error ? error.message : "Не удалось загрузить серверы Exaroton");
        }
      } finally {
        if (!cancelled) setLoadingServers(false);
      }
    }

    loadServers();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === serverId) || null,
    [serverId, servers],
  );
  const players = selectedServer?.players.list || [];
  const canExecute = Boolean(selectedServer && selectedServer.status === 1 && selectedServer.players.listAvailable && player && !busy);

  if (!authorized) {
    return null;
  }

  async function executeCommand() {
    if (!selectedServer || !player) return;

    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/minecraft/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, serverId: selectedServer.id, player, snapshot }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось выполнить команду");
      }
      setResult({ tone: "success", text: data.message || "Команда выполнена успешно." });
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Не удалось выполнить команду" });
    } finally {
      setBusy(false);
    }
  }

  function onServerChange(nextServerId: string) {
    setServerId(nextServerId);
    setPlayer("");
    setResult(null);
  }

  return (
    <section className="panel server-execute-panel">
      <h2>Выполнить на сервере <span className="sub">только для админа</span></h2>

      {loadingServers ? (
        <p className="server-execute-message">Загружаем серверы Exaroton...</p>
      ) : serverError ? (
        <p className="server-execute-message error">{serverError}</p>
      ) : servers.length ? (
        <>
          <div className="grid-2">
            <label>
              <span className="lab">Сервер</span>
              <select value={serverId} onChange={(event) => onServerChange(event.target.value)}>
                <option value="">- выбери сервер -</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} - {server.statusLabel}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="lab">Игрок</span>
              <select
                value={player}
                onChange={(event) => {
                  setPlayer(event.target.value);
                  setResult(null);
                }}
                disabled={!selectedServer || selectedServer.status !== 1 || !selectedServer.players.listAvailable || !players.length}
              >
                <option value="">- выбери игрока -</option>
                {players.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>

          {selectedServer ? <ServerNotice server={selectedServer} /> : null}

          <div className="btn-row server-execute-actions">
            <button type="button" onClick={executeCommand} disabled={!canExecute}>
              {busy ? "Выполняем..." : "Выполнить на сервере"}
            </button>
            <button className="sec" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={busy}>
              Обновить серверы
            </button>
          </div>

          {result ? <p className={`server-execute-message ${result.tone}`}>{result.text}</p> : null}
        </>
      ) : (
        <p className="server-execute-message">Сейчас нет онлайн-серверов Exaroton для выполнения команды.</p>
      )}
    </section>
  );
}

function ServerNotice({ server }: { server: ExarotonServer }) {
  if (server.status !== 1) {
    return <p className="server-execute-message error">Сервер сейчас недоступен для выполнения: {server.statusLabel}.</p>;
  }

  if (!server.players.listAvailable) {
    return <p className="server-execute-message error">Exaroton видит {server.players.count} игрок(ов), но не отдал список имён. Выбор игрока недоступен.</p>;
  }

  if (!server.players.list.length) {
    return <p className="server-execute-message">Сервер онлайн, но игроков сейчас нет.</p>;
  }

  return (
    <p className="server-execute-message success">
      Онлайн {server.players.count}
      {server.players.max !== null ? ` / ${server.players.max}` : ""}: выбери игрока из списка.
    </p>
  );
}
