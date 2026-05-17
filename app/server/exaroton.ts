type ExarotonApiResponse<T> = {
  success?: boolean;
  error?: string | null;
  data?: T | null;
};

type ExarotonApiServer = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  motd?: unknown;
  status?: unknown;
  host?: unknown;
  port?: unknown;
  players?: unknown;
  software?: unknown;
  shared?: unknown;
};

type ExarotonApiPlayers = {
  max?: unknown;
  count?: unknown;
  list?: unknown;
};

type ExarotonApiSoftware = {
  name?: unknown;
  version?: unknown;
};

export type ExarotonServer = {
  id: string;
  name: string;
  address: string | null;
  motd: string | null;
  status: number;
  statusLabel: string;
  statusTone: "online" | "busy" | "offline" | "error";
  host: string | null;
  port: number | null;
  players: {
    max: number | null;
    count: number;
    list: string[];
    listAvailable: boolean;
  };
  software: {
    name: string | null;
    version: string | null;
  } | null;
  shared: boolean;
};

export type ExarotonServersResult =
  | {
      configured: true;
      ok: true;
      servers: ExarotonServer[];
      fetchedAt: string;
    }
  | {
      configured: true;
      ok: false;
      error: string;
      servers: [];
      fetchedAt: string;
    }
  | {
      configured: false;
      ok: false;
      error: string;
      servers: [];
      fetchedAt: null;
    };

const EXAROTON_API_BASE_URL = "https://api.exaroton.com/v1";

const STATUS_LABELS: Record<number, string> = {
  0: "Выключен",
  1: "Онлайн",
  2: "Запускается",
  3: "Останавливается",
  4: "Перезапускается",
  5: "Сохраняется",
  6: "Загружается",
  7: "Упал",
  8: "В очереди",
  9: "Переносится",
  10: "Готовится",
};

function getExarotonApiKey() {
  return (
    process.env.EXAROTON_API_KEY ||
    process.env.EXAROTON_TOKEN ||
    process.env.EXAROTON_API_TOKEN ||
    ""
  ).trim();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asPlayerList(value: unknown) {
  if (!Array.isArray(value)) {
    return { list: [], available: false };
  }

  return {
    list: value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim()),
    available: true,
  };
}

function getStatusTone(status: number): ExarotonServer["statusTone"] {
  if (status === 1) return "online";
  if ([2, 3, 4, 5, 6, 8, 9, 10].includes(status)) return "busy";
  if (status === 7) return "error";
  return "offline";
}

function normalizeServer(server: ExarotonApiServer): ExarotonServer | null {
  const id = asString(server.id);
  if (!id) return null;

  const players = asObject(server.players) as ExarotonApiPlayers;
  const playerList = asPlayerList(players.list);
  const software = asObject(server.software) as ExarotonApiSoftware;
  const status = asNumber(server.status) ?? 0;

  return {
    id,
    name: asString(server.name) || id,
    address: asString(server.address),
    motd: asString(server.motd),
    status,
    statusLabel: STATUS_LABELS[status] || `Статус ${status}`,
    statusTone: getStatusTone(status),
    host: asString(server.host),
    port: asNumber(server.port),
    players: {
      max: asNumber(players.max),
      count: asNumber(players.count) ?? 0,
      list: playerList.list,
      listAvailable: playerList.available,
    },
    software:
      Object.keys(software).length > 0
        ? {
            name: asString(software.name),
            version: asString(software.version),
          }
        : null,
    shared: server.shared === true,
  };
}

export async function listExarotonServers(): Promise<ExarotonServersResult> {
  const token = getExarotonApiKey();
  if (!token) {
    return {
      configured: false,
      ok: false,
      error: "EXAROTON_API_KEY не настроен",
      servers: [],
      fetchedAt: null,
    };
  }

  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(`${EXAROTON_API_BASE_URL}/servers/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const body = (await response.json().catch(() => null)) as ExarotonApiResponse<
      ExarotonApiServer[]
    > | null;

    if (!response.ok || !body?.success || !Array.isArray(body.data)) {
      return {
        configured: true,
        ok: false,
        error: body?.error || `Exaroton API вернул HTTP ${response.status}`,
        servers: [],
        fetchedAt,
      };
    }

    return {
      configured: true,
      ok: true,
      servers: body.data
        .map(normalizeServer)
        .filter((server): server is ExarotonServer => Boolean(server)),
      fetchedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось получить серверы Exaroton",
      servers: [],
      fetchedAt,
    };
  }
}
