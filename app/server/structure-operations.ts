import { parseProject } from "../structure-core";
import { assertMaterials, parseToolArguments, validateStructure, type BatchUpdateInstancesArguments, type UpdateInstanceArguments } from "../structure-core/operations";
import { getStructureProject, updateStructureProject, StructureProjectError } from "./structure-projects";

export async function updateStructureInstance(userId: string, input: unknown) {
  let args: UpdateInstanceArguments;
  try { args = parseToolArguments("update_instance",input) as UpdateInstanceArguments; }
  catch { throw new StructureProjectError("Некорректные аргументы изменения экземпляра.",400); }
  const saved = await getStructureProject(userId,args.projectId);
  if (saved.document.revision !== args.expectedRevision) throw new StructureProjectError("Проект изменён. Загрузите актуальную версию.",409);
  if (!saved.document.instances.some(item => item.id===args.instanceId)) throw new StructureProjectError("Экземпляр не найден.",404);
  try {
    const project = parseProject({...saved.document, instances:saved.document.instances.map(item => item.id===args.instanceId ? {...item,...args.changes} : item)});
    assertMaterials(project);
    return await updateStructureProject(userId,args.projectId,args.expectedRevision,project);
  } catch (error) {
    if (error instanceof StructureProjectError) throw error;
    throw new StructureProjectError("Некорректная структура.",400);
  }
}
export async function batchUpdateStructureInstances(userId: string, input: unknown) {
  let args: BatchUpdateInstancesArguments;
  try { args = parseToolArguments("batch_update_instances",input) as BatchUpdateInstancesArguments; }
  catch (error) { throw new StructureProjectError("Некорректный пакет изменений.",error instanceof Error && error.message==="TOO_LARGE" ? 413 : 400); }
  const saved = await getStructureProject(userId,args.projectId);
  if (saved.document.revision !== args.expectedRevision) throw new StructureProjectError("Проект изменён. Загрузите актуальную версию.",409);
  const updates = new Map(args.updates.map(update=>[update.instanceId,update.changes]));
  const ids = new Set(saved.document.instances.map(item=>item.id));
  if (args.updates.some(update=>!ids.has(update.instanceId))) throw new StructureProjectError("Экземпляр не найден.",404);
  try {
    const project = parseProject({...saved.document,instances:saved.document.instances.map(item=>({...item,...updates.get(item.id)}))});
    assertMaterials(project);
    // The existing storage service validates final geometry then performs one CAS.
    return await updateStructureProject(userId,args.projectId,args.expectedRevision,project);
  } catch (error) {
    if (error instanceof StructureProjectError) throw error;
    throw new StructureProjectError("Некорректная структура.",400);
  }
}
export async function validateOwnerStructure(userId:string, id:string, input:unknown) {
  await getStructureProject(userId,id);
  return validateStructure(input,id);
}
