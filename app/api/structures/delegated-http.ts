import { getAuthUser } from "../../server/auth";
import { authenticateStructureDelegation } from "../../server/structure-delegations";
import { StructureProjectError } from "../../server/structure-projects";
import type { StructureTool } from "../../structure-core/operations";
import { json } from "./http";
const messages:Record<number,[string,string]> = {
  400:["INVALID_ARGUMENT","Некорректные аргументы."],401:["UNAUTHORIZED","Войдите или проверьте срок и отзыв доступа."],403:["FORBIDDEN","Операция не разрешена."],404:["NOT_FOUND","Проект или экземпляр не найден."],409:["CONFLICT","Проект изменён. Загрузите актуальную версию."],413:["TOO_LARGE","Запрос слишком большой."],415:["UNSUPPORTED_MEDIA_TYPE","Ожидается JSON."],503:["UNAVAILABLE","Сервис временно недоступен."],
};
export function safeStructureError(error:unknown) {
  const status=error instanceof StructureProjectError && messages[error.status] ? error.status : 503;
  const [code,message]=messages[status];
  return json({error:message,code},status);
}
export async function withStructureAccess(request:Request,projectId:string,scope:StructureTool,action:(owner:string)=>Promise<Response>) {
  try {
    if (request.method!=="GET" && !request.headers.get("content-type")?.startsWith("application/json")) throw new StructureProjectError("JSON",415);
    const origin=request.headers.get("origin");
    if (origin && origin!==new URL(request.url).origin) throw new StructureProjectError("Origin",403);
    let owner:string;
    // Never fall back to cookies for an invalid bearer.
    if (request.headers.has("authorization")) owner=await authenticateStructureDelegation(request,projectId,scope);
    else {
      if (request.method!=="GET" && origin!==new URL(request.url).origin) throw new StructureProjectError("Origin",403);
      const user=await getAuthUser();
      if (!user) throw new StructureProjectError("Session",401);
      owner=user.id;
    }
    return await action(owner);
  } catch(error) { return safeStructureError(error); }
}
