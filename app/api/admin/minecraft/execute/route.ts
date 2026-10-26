import { getAuthUser, isGoogleAuthConfigured } from "../../../../server/auth";
import { buildMinecraftExecutionCommand } from "../../../../server/minecraft-command-execution";
import { executeExarotonCommand, listExarotonServers } from "../../../../server/exaroton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Mode = "give" | "summon";

const playerNamePattern = /^[A-Za-z0-9_]{1,16}$/;

async function requireAdmin() {
  if (!isGoogleAuthConfigured()) {
    return Response.json({ ok: false, error: "Google-вход не настроен" }, { status: 503 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "Войдите, чтобы выполнить команду" }, { status: 401 });
  }

  if (!user.isAdmin) {
    return Response.json({ ok: false, error: "Выполнение доступно только администратору" }, { status: 403 });
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: Request) {
  const error = await requireAdmin();
  if (error) return error;

  const body = asRecord(await request.json().catch(() => null));
  const mode = body.mode === "give" || body.mode === "summon" ? body.mode as Mode : null;
  const serverId = typeof body.serverId === "string" ? body.serverId.trim() : "";
  const player = typeof body.player === "string" ? body.player.trim() : "";

  if (!mode) {
    return Response.json({ ok: false, error: "Неизвестный генератор" }, { status: 400 });
  }

  if (!serverId) {
    return Response.json({ ok: false, error: "Выберите сервер" }, { status: 400 });
  }

  const serversResult = await listExarotonServers();
  if (!serversResult.configured) {
    return Response.json({ ok: false, error: "EXAROTON_API_KEY не настроен" }, { status: 503 });
  }
  if (!serversResult.ok) {
    return Response.json({ ok: false, error: `Не удалось получить серверы Exaroton: ${serversResult.error}` }, { status: 502 });
  }

  const server = serversResult.servers.find((item) => item.id === serverId);
  if (!server) {
    return Response.json({ ok: false, error: "Сервер не найден в Exaroton" }, { status: 404 });
  }
  if (server.status !== 1) {
    return Response.json({ ok: false, error: `Сервер сейчас не онлайн: ${server.statusLabel}` }, { status: 409 });
  }
  let executionCommand;
  try {
    executionCommand = buildMinecraftExecutionCommand({
      mode,
      player,
      snapshot: body.snapshot,
      count: body.count,
      summonSpawn: body.summonSpawn,
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Команда получилась некорректной",
    }, { status: 400 });
  }

  if (executionCommand.requiresPlayer) {
    if (!playerNamePattern.test(player)) {
      return Response.json({ ok: false, error: "Выберите игрока из списка сервера" }, { status: 400 });
    }
    if (!server.players.listAvailable) {
      return Response.json({ ok: false, error: "Exaroton не отдал список игроков этого сервера" }, { status: 409 });
    }
    if (!server.players.list.includes(player)) {
      return Response.json({ ok: false, error: "Выбранный игрок сейчас не найден на сервере" }, { status: 409 });
    }
  }

  if (executionCommand.command.includes("\n") || executionCommand.command.includes("\r")) {
    return Response.json({ ok: false, error: "Команда получилась некорректной" }, { status: 400 });
  }

  const command = executionCommand.command;
  if (!command.startsWith(executionCommand.validPrefix)) {
    return Response.json({ ok: false, error: "Можно выполнять только команды текущего генератора" }, { status: 400 });
  }

  const result = await executeExarotonCommand(server.id, command);
  if (!result.configured) {
    return Response.json({ ok: false, error: "EXAROTON_API_KEY не настроен" }, { status: 503 });
  }
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 502 });
  }

  return Response.json({
    ok: true,
    message: mode === "give"
      ? `Предмет отправлен игроку ${player} на сервере ${server.name}.`
      : executionCommand.requiresPlayer
        ? `Моб создан для игрока ${player} на сервере ${server.name}.`
        : `Моб создан на сервере ${server.name}.`,
  });
}
