import { SchematicError, schematicResponse } from "../../../server/structure-schematic";
import { StructureProjectError } from "../../../server/structure-projects";
import { json, readBody } from "../http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Explicit anonymous snapshot export: no database lookup or persistence by supplied ID.
export async function POST(request:Request) {
  try {
    const origin=request.headers.get("origin");
    if (origin && origin!==new URL(request.url).origin) return json({error:"Недопустимый источник запроса."},403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({error:"Ожидается JSON."},415);
    const body=await readBody(request);
    if (Object.keys(body).length!==1 || !Object.hasOwn(body,"document")) return json({error:"Ожидается только document."},400);
    return schematicResponse(body.document);
  } catch (error) {
    if (error instanceof StructureProjectError) return json({error:error.message},error.status);
    if (error instanceof SchematicError) return json({error:error.message},400);
    return json({error:"Не удалось создать файл. Повторите экспорт."},503);
  }
}
