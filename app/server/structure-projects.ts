import { deserializeProject, generateProject, type StructureProject } from "../structure-core";
import { getSql } from "./db";

export class StructureProjectError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type ProjectSummary = { id: string; name: string; revision: number; updatedAt: string };
type Row = { id: string; revision: number; format_version: number; document: StructureProject; updated_at: string };
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  const sql = getSql();
  await sql`create table if not exists structure_projects (
    id text primary key, user_id text not null, revision integer not null check (revision > 0),
    format_version integer not null, document jsonb not null, updated_at timestamptz not null default now(),
    check (document->>'id' = id), check ((document->>'revision')::integer = revision),
    check ((document->>'formatVersion')::integer = format_version)
  )`;
  await sql`create index if not exists structure_projects_user_updated_idx on structure_projects (user_id, updated_at desc)`;
  tableReady = true;
}
export function assertProjectId(id: string) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new StructureProjectError("Некорректный ID проекта.", 400);
}
export function assertExpectedRevision(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1 || value >= 2147483647) throw new StructureProjectError("Некорректная ожидаемая версия.", 400);
}
function validate(input: unknown, id: string, revision: number) {
  try {
    // Parse strictly before overriding storage metadata; extra fields (including user_id) are rejected.
    const project = deserializeProject(JSON.stringify(input));
    project.id = id;
    project.revision = revision;
    project.name = project.name.trim();
    if (generateProject(project).conflicts.length) throw Error("Комнаты пересекаются. Устраните пересечения перед сохранением.");
    return project;
  } catch (error) { throw new StructureProjectError(error instanceof Error ? error.message : "Некорректный проект.", 400); }
}
// jsonb may reorder keys inside arbitrary BlockState properties.
function canonicalJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
}
function saved(row: Row) {
  return { document: row.document, updatedAt: row.updated_at };
}
export async function listStructureProjects(userId: string): Promise<ProjectSummary[]> {
  await ensureTable();
  const rows = await getSql()`select id, document->>'name' as name, revision, updated_at from structure_projects where user_id = ${userId} order by updated_at desc, id` as Array<{id:string;name:string;revision:number;updated_at:string}>;
  return rows.map(row => ({ id: row.id, name: row.name, revision: row.revision, updatedAt: row.updated_at }));
}
export async function getStructureProject(userId: string, id: string) {
  assertProjectId(id); await ensureTable();
  const rows = await getSql()`select * from structure_projects where id = ${id} and user_id = ${userId}` as Row[];
  if (!rows[0]) throw new StructureProjectError("Проект не найден.", 404);
  return saved(rows[0]);
}
export async function createStructureProject(userId: string, id: string, input: unknown) {
  assertProjectId(id);
  const document = validate(input, id, 1);
  await ensureTable();
  const rows = await getSql()`insert into structure_projects (id, user_id, revision, format_version, document)
    values (${id}, ${userId}, 1, ${document.formatVersion}, ${JSON.stringify(document)}::jsonb)
    on conflict (id) do nothing returning *` as Row[];
  if (rows[0]) return saved(rows[0]);
  // An identical retried create is safe after a lost response, but cannot overwrite a later edit.
  const existing = await getStructureProject(userId, id);
  if (existing.document.revision === 1) {
    if (canonicalJson(existing.document) === canonicalJson(document)) return existing;
  }
  throw new StructureProjectError("Проект уже существует. Загрузите серверную версию.", 409);
}
export async function updateStructureProject(userId: string, id: string, expectedRevision: number, input: unknown) {
  assertProjectId(id); assertExpectedRevision(expectedRevision);
  const document = validate(input, id, expectedRevision + 1);
  await ensureTable();
  const rows = await getSql()`update structure_projects set revision = revision + 1,
    format_version = ${document.formatVersion}, document = ${JSON.stringify(document)}::jsonb, updated_at = now()
    where id = ${id} and user_id = ${userId} and revision = ${expectedRevision} returning *` as Row[];
  if (rows[0]) return saved(rows[0]);
  await getStructureProject(userId, id);
  throw new StructureProjectError("Проект изменён в другой вкладке. Локальные правки сохранены в редакторе.", 409);
}
export async function deleteStructureProject(userId: string, id: string, expectedRevision: number) {
  assertProjectId(id); assertExpectedRevision(expectedRevision); await ensureTable();
  const rows = await getSql()`delete from structure_projects where id = ${id} and user_id = ${userId} and revision = ${expectedRevision} returning id` as {id:string}[];
  if (rows.length) return;
  await getStructureProject(userId, id);
  throw new StructureProjectError("Проект изменён. Загрузите серверную версию перед удалением.", 409);
}
