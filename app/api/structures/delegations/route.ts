import { issueStructureDelegation, listStructureDelegations, revokeStructureDelegation } from "../../../server/structure-delegations";
import { StructureProjectError } from "../../../server/structure-projects";
import { strictObject } from "../../../structure-core/operations";
import { withUser, json, readBody } from "../http";
import { safeStructureError } from "../delegated-http";
export const dynamic="force-dynamic";
async function handle(request:Request, action:(owner:string)=>Promise<Response>) {
  if (request.headers.has("authorization")) return safeStructureError(new StructureProjectError("Session required",401));
  if (request.method!=="GET" && request.headers.get("origin")!==new URL(request.url).origin) return safeStructureError(new StructureProjectError("Origin",403));
  return withUser(request,async owner=>{
    try { return await action(owner); } catch(error) { return safeStructureError(error); }
  });
}
export async function GET(request:Request) { return handle(request,async owner=>json({delegations:await listStructureDelegations(owner)})); }
export async function POST(request:Request) { return handle(request,async owner=>json(await issueStructureDelegation(owner,await readBody(request)),201)); }
export async function DELETE(request:Request) { return handle(request,async owner=>{
  const body=await readBody(request);
  try { strictObject(body,["id"]); if (typeof body.id!=="string") throw Error(); } catch { throw new StructureProjectError("Arguments",400); }
  await revokeStructureDelegation(owner,body.id); return json({ok:true});
}); }
