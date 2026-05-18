import { currentUser } from "@clerk/nextjs/server";
import { isAdminFromMetadata, isClerkConfigured } from "../../../../server/auth";
import { listExarotonServers } from "../../../../server/exaroton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  if (!isClerkConfigured()) {
    return Response.json({ ok: false, error: "Clerk не настроен" }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Войдите, чтобы видеть серверы" }, { status: 401 });
  }

  if (!isAdminFromMetadata(user)) {
    return Response.json({ ok: false, error: "Доступно только администратору" }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const error = await requireAdmin();
  if (error) return error;

  const result = await listExarotonServers();
  return Response.json({ ok: result.ok, exaroton: result }, { status: result.configured ? 200 : 503 });
}
