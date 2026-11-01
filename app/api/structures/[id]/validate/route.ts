import { validateOwnerStructure } from "../../../../server/structure-operations";
import { strictObject } from "../../../../structure-core/operations";
import { StructureProjectError } from "../../../../server/structure-projects";
import { withStructureAccess } from "../../delegated-http";
import { json, readBody } from "../../http";
export const dynamic="force-dynamic";
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const id=(await context.params).id;
  return withStructureAccess(request,id,"validate_structure",async owner=>{
    const body=await readBody(request);
    try { strictObject(body,["document"]); }
    catch { throw new StructureProjectError("Arguments",400); }
    return json(await validateOwnerStructure(owner,id,body.document));
  });
}
