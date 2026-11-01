import { deleteStructureProject, getStructureProject, updateStructureProject } from "../../../server/structure-projects";
import { json, readBody, withUser } from "../http";
import { withStructureAccess } from "../delegated-http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const id = (await context.params).id;
  return withStructureAccess(request, id, "get_project", async userId => json(await getStructureProject(userId, id)));
}
export async function PUT(request: Request, context: Context) {
  return withUser(request, async userId => {
    const body = await readBody(request);
    return json(await updateStructureProject(userId, (await context.params).id, body.expectedRevision, body.document));
  });
}
export async function DELETE(request: Request, context: Context) {
  return withUser(request, async userId => {
    const body = await readBody(request);
    await deleteStructureProject(userId, (await context.params).id, body.expectedRevision);
    return json({ ok: true });
  });
}
