import { neon } from "@neondatabase/serverless";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;

export function getDatabaseUrlStatus() {
  return {
    configured: Boolean(process.env.DATABASE_URL),
    driver: "@neondatabase/serverless",
  };
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  sqlClient ??= neon(process.env.DATABASE_URL);

  return sqlClient;
}

export async function checkDatabaseConnection() {
  const sql = getSql();
  const rows = (await sql`
    select 1 as ok, current_database() as database_name
  `) as Array<{ ok: number; database_name: string }>;
  const result = rows[0];

  return {
    connected: result.ok === 1,
    databaseName: result.database_name,
  };
}
