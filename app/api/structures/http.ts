import { getAuthUser } from "../../server/auth";
import { StructureProjectError } from "../../server/structure-projects";
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function withUser(request: Request, action: (userId: string) => Promise<Response>) {
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new StructureProjectError("Недопустимый источник запроса.", 403);
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new StructureProjectError("Ожидается JSON.", 415);
    }
    const user = await getAuthUser();
    if (!user) throw new StructureProjectError("Войдите через Google для облачного сохранения.", 401);
    return await action(user.id);
  } catch (error) {
    if (error instanceof StructureProjectError) return json({ error: error.message }, error.status);
    return json({ error: "Облачное хранилище недоступно. Повторите запрос; локальные правки остаются в редакторе." }, 503);
  }
}
export async function readBody(request: Request) {
  // Bound the stream itself, not only Content-Length (which may be absent or forged).
  const reader = request.body?.getReader();
  if (!reader) throw new StructureProjectError("Пустой запрос.", 400);
  const decoder = new TextDecoder(); let text = "", size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) { await reader.cancel(); throw new StructureProjectError("Проект слишком большой.", 413); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { const body = JSON.parse(text); if (!body || typeof body !== "object" || Array.isArray(body)) throw Error(); return body; }
  catch { throw new StructureProjectError("Некорректный JSON.", 400); }
}
