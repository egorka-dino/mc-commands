import { getStructureProject } from "../../../../server/structure-projects";
import { SchematicError, schematicResponse } from "../../../../server/structure-schematic";
import { json, withUser } from "../../http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  return withUser(request,async userId=>{
    const saved=await getStructureProject(userId,(await context.params).id);
    try { return schematicResponse(saved.document); }
    catch (error) { if (error instanceof SchematicError) return json({error:error.message},400); throw error; }
  });
}
