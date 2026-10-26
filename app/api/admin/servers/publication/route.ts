import { getDatabaseUrlStatus } from "../../../../server/db";
import { getAuthUser, isGoogleAuthConfigured } from "../../../../server/auth";
import {
  listExarotonServerPublications,
  setExarotonServerPublished,
} from "../../../../server/exaroton-publications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  if (!isGoogleAuthConfigured()) {
    return Response.json({ ok: false, error: "Google auth is not configured" }, { status: 503 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isAdmin) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (!getDatabaseUrlStatus().configured) {
    return Response.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  }

  return null;
}

export async function GET() {
  const error = await requireAdmin();
  if (error) return error;

  return Response.json({
    ok: true,
    publicationSettings: await listExarotonServerPublications(),
  });
}

export async function POST(request: Request) {
  const error = await requireAdmin();
  if (error) return error;

  try {
    const body = (await request.json()) as { serverId?: unknown; published?: unknown };
    const publication = await setExarotonServerPublished(body.serverId, body.published);
    return Response.json({ ok: true, publication });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Не удалось сохранить публикацию" },
      { status: 400 },
    );
  }
}
