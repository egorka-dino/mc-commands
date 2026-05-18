import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata, isClerkConfigured } from "../../../../server/auth";
import { buildGiveCommand, defaultGiveSnapshot, type GiveSnapshot } from "../../../../components/give/engine";
import { buildSummonCommand, normalizeSnapshot, toSnapshot } from "../../../../components/summon/engine";
import type { SummonSnapshot } from "../../../../components/summon/data";
import { executeExarotonCommand, listExarotonServers } from "../../../../server/exaroton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Mode = "give" | "summon";

const playerNamePattern = /^[A-Za-z0-9_]{1,16}$/;

async function requireAdmin() {
  if (!isClerkConfigured()) {
    return Response.json({ ok: false, error: "Clerk не настроен" }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Войдите, чтобы выполнить команду" }, { status: 401 });
  }

  if (!isAdminFromMetadata(user)) {
    return Response.json({ ok: false, error: "Выполнение доступно только администратору" }, { status: 403 });
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asGiveSnapshot(value: unknown): GiveSnapshot {
  const source = asRecord(value);
  const fallback = defaultGiveSnapshot();

  return {
    ...fallback,
    itemId: typeof source.itemId === "string" ? source.itemId : fallback.itemId,
    target: "@s",
    targetCustom: "",
    count: typeof source.count === "string" || typeof source.count === "number" ? String(source.count) : fallback.count,
    fields: asRecord(source.fields) as GiveSnapshot["fields"],
    explosions: Array.isArray(source.explosions) ? source.explosions as GiveSnapshot["explosions"] : fallback.explosions,
    shieldLayers: Array.isArray(source.shieldLayers) ? source.shieldLayers as GiveSnapshot["shieldLayers"] : fallback.shieldLayers,
    potionType: typeof source.potionType === "string" ? source.potionType : fallback.potionType,
    potionModifier: typeof source.potionModifier === "string" ? source.potionModifier : fallback.potionModifier,
  };
}

function asSummonSnapshot(value: unknown): SummonSnapshot {
  const source = asRecord(value);
  const mobOrder = Array.isArray(source.mobOrder) ? source.mobOrder : toSnapshot(["zombie"]).mobOrder;
  return normalizeSnapshot({
    mobOrder: mobOrder
      .map((item) => asRecord(item))
      .map((item) => ({ mobType: typeof item.mobType === "string" ? item.mobType : "zombie" })),
    fields: asRecord(source.fields) as SummonSnapshot["fields"],
  });
}

function stripSlash(command: string) {
  return command.replace(/^\//, "");
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

  if (!playerNamePattern.test(player)) {
    return Response.json({ ok: false, error: "Выберите игрока из списка сервера" }, { status: 400 });
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
  if (!server.players.listAvailable) {
    return Response.json({ ok: false, error: "Exaroton не отдал список игроков этого сервера" }, { status: 409 });
  }
  if (!server.players.list.includes(player)) {
    return Response.json({ ok: false, error: "Выбранный игрок сейчас не найден на сервере" }, { status: 409 });
  }

  const generatedCommand = mode === "give"
    ? buildGiveCommand({ ...asGiveSnapshot(body.snapshot), target: "@s", targetCustom: player })
    : `execute at ${player} run ${stripSlash(buildSummonCommand(asSummonSnapshot(body.snapshot), "~ ~ ~"))}`;

  if (generatedCommand.includes("\n") || generatedCommand.includes("\r")) {
    return Response.json({ ok: false, error: "Команда получилась некорректной" }, { status: 400 });
  }

  const command = stripSlash(generatedCommand);
  const validPrefix = mode === "give" ? `give ${player} ` : `execute at ${player} run summon `;
  if (!command.startsWith(validPrefix)) {
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
      : `Моб создан рядом с игроком ${player} на сервере ${server.name}.`,
  });
}
