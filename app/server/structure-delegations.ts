import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getSql } from "./db";
import { getStructureProject, StructureProjectError } from "./structure-projects";
import { strictObject, STRUCTURE_TOOLS, type StructureTool } from "../structure-core/operations";

let ready = false;
async function ensureTable() {
  if (ready) return;
  await getSql()`create table if not exists structure_delegations (
    id uuid primary key, user_id text not null, project_id text not null,
    name text not null, secret_hash text unique not null, scopes jsonb not null,
    created_at timestamptz not null default now(), expires_at timestamptz not null,
    revoked_at timestamptz
  )`;
  await getSql()`create index if not exists structure_delegations_owner_idx on structure_delegations(user_id, created_at desc)`;
  ready=true;
}
export const hashDelegationSecret = (secret:string) => createHash("sha256").update(secret).digest("hex");
export async function issueStructureDelegation(userId:string, input:unknown) {
  let body: Record<string,unknown>;
  try { body = strictObject(input,["projectId","name","scopes","hours"]); }
  catch { throw new StructureProjectError("Некорректное делегирование.",400); }
  const {projectId,name,scopes,hours}=body;
  if (typeof projectId!=="string" || typeof name!=="string" || !name.trim() || name.length>80 || /[\x00-\x1f\x7f]/.test(name) || !Array.isArray(scopes) || !scopes.length || scopes.length>STRUCTURE_TOOLS.length || new Set(scopes).size!==scopes.length || scopes.some(scope=>!STRUCTURE_TOOLS.includes(scope)) || typeof hours!=="number" || !Number.isInteger(hours) || hours<1 || hours>168) throw new StructureProjectError("Некорректное делегирование.",400);
  await getStructureProject(userId,projectId);
  await ensureTable();
  const secret=`ss1_${randomBytes(32).toString("base64url")}`, id=randomUUID();
  const expiresAt=new Date(Date.now()+hours*3600000).toISOString();
  await getSql()`insert into structure_delegations(id,user_id,project_id,name,secret_hash,scopes,expires_at)
    values (${id},${userId},${projectId},${name.trim()},${hashDelegationSecret(secret)},${JSON.stringify(scopes)}::jsonb,${expiresAt}::timestamptz)`;
  return {id,secret,projectId,scopes,expiresAt};
}
export async function listStructureDelegations(userId:string) {
  await ensureTable();
  return await getSql()`select id, project_id as "projectId", name, scopes, created_at as "createdAt", expires_at as "expiresAt", revoked_at as "revokedAt" from structure_delegations where user_id=${userId} order by created_at desc`;
}
export async function revokeStructureDelegation(userId:string,id:string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new StructureProjectError("Некорректный ID.",400);
  await ensureTable();
  const rows=await getSql()`update structure_delegations set revoked_at=coalesce(revoked_at,now()) where id=${id}::uuid and user_id=${userId} returning id` as {id:string}[];
  if (!rows.length) throw new StructureProjectError("Делегирование не найдено.",404);
}
export async function authenticateStructureDelegation(request:Request,projectId:string,scope:StructureTool) {
  const authorization=request.headers.get("authorization") || "";
  if (!/^Bearer ss1_[A-Za-z0-9_-]{43}$/.test(authorization)) throw new StructureProjectError("Доступ не подтверждён.",401);
  await ensureTable();
  const rows=await getSql()`select user_id, project_id, scopes from structure_delegations where secret_hash=${hashDelegationSecret(authorization.slice(7))} and revoked_at is null and expires_at>now()` as {user_id:string;project_id:string;scopes:string[]}[];
  const row=rows[0];
  if (!row) throw new StructureProjectError("Доступ не подтверждён.",401);
  if (row.project_id!==projectId) throw new StructureProjectError("Проект не найден.",404);
  if (!row.scopes.includes(scope)) throw new StructureProjectError("Операция не разрешена.",403);
  return row.user_id;
}
