import { checkDatabaseConnection, getDatabaseUrlStatus } from "../../../server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getDatabaseUrlStatus();

  if (!status.configured) {
    return Response.json({
      ok: false,
      database: status,
    });
  }

  try {
    const connection = await checkDatabaseConnection();

    return Response.json({
      ok: true,
      database: {
        ...status,
        ...connection,
      },
    });
  } catch {
    return Response.json(
      {
        ok: false,
        database: {
          ...status,
          connected: false,
        },
      },
      { status: 503 },
    );
  }
}
