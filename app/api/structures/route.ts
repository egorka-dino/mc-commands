import { createStructureProject, listStructureProjects } from "../../server/structure-projects";
import { json, readBody, withUser } from "./http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withUser(request, async userId => json({ projects: await listStructureProjects(userId) }));
}
export async function POST(request: Request) {
  return withUser(request, async userId => {
    const body = await readBody(request);
    return json(await createStructureProject(userId, body.id, body.document), 201);
  });
}
