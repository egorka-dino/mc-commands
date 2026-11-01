import { deserializeProject, generateProject, parseProject, defaultStoneRoomParameters, type StructureProject } from "./index";

export const STRUCTURE_TOOLS = ["get_project", "update_instance", "validate_structure"] as const;
export type StructureTool = typeof STRUCTURE_TOOLS[number];
export const SUPPORTED_MATERIALS = ["minecraft:stone_bricks", "minecraft:stone", "minecraft:cobblestone", "minecraft:deepslate_bricks", "minecraft:oak_planks", "minecraft:bricks", "minecraft:quartz_block"];
const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const label = { type: "string", minLength: 1, maxLength: 200 };
const projectId = { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$" };
const integer = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const position = objectSchema({ x: integer(-30000000,30000000), y: integer(-30000000,30000000), z: integer(-30000000,30000000) });
const rotation = { type: "integer", enum: [0,90,180,270] };
const block = objectSchema({ id: { type:"string", enum:SUPPORTED_MATERIALS }, properties: objectSchema({}) });
function parametersSchema(material: Record<string,unknown>) {
  return objectSchema({width:{...integer(5,129),not:{multipleOf:2}},length:{...integer(5,129),not:{multipleOf:2}},height:integer(6,128),wallThickness:{const:1},wall:material,floor:material,ceiling:material,doors:objectSchema({north:{type:"boolean"},east:{type:"boolean"},south:{type:"boolean"},west:{type:"boolean"}})});
}
const parameters=parametersSchema(block);
function projectSchema(roomParameters: Record<string,unknown>) {
  return objectSchema({formatVersion:{const:1},id:label,name:label,revision:integer(0,Number.MAX_SAFE_INTEGER),definitions:{type:"array",maxItems:100,items:objectSchema({id:label,generator:{const:"room.stone_basic.v1"},parameters:roomParameters})},instances:{type:"array",maxItems:100,items:objectSchema({id:label,definitionId:label,parameters:roomParameters,position,rotation})}});
}
const document=projectSchema(parameters);
export const toolSchemas = {
  get_project: objectSchema({projectId}),
  update_instance: objectSchema({projectId, instanceId:label, expectedRevision:integer(1,2147483646), changes:{...objectSchema({parameters,position,rotation},[]),minProperties:1}}),
  validate_structure: objectSchema({projectId,document}),
};
// Stored projects retain the full core BlockState contract even when MCP edits
// deliberately support only the seven currently rendered materials.
const outputDocument=projectSchema(parametersSchema(objectSchema({id:{type:"string",pattern:"^[a-z0-9_.-]+:[a-z0-9_./-]+$"},properties:{type:"object",additionalProperties:{type:"string"}}})));
const successfulOutputSchemas = {
  get_project: objectSchema({document:outputDocument,updatedAt:{type:"string"}}),
  update_instance: objectSchema({document:outputDocument,updatedAt:{type:"string"}}),
  validate_structure: objectSchema({valid:{type:"boolean"},diagnostics:{type:"array",maxItems:20,items:objectSchema({code:{type:"string",enum:["INVALID_STRUCTURE","UNSUPPORTED_MATERIAL","OVERLAP"]},message:{type:"string"}})},cellCount:integer(0,250000),conflictCount:integer(0,250000)}),
};
const failureSchema = objectSchema({code:{type:"string"},message:{type:"string"},status:integer(0,599)});
export const outputSchemas = Object.fromEntries(Object.entries(successfulOutputSchemas).map(([name,schema]) => [name,{type:"object",properties:{...schema.properties,error:failureSchema},additionalProperties:false,oneOf:[{required:schema.required},{required:["error"]}]}]));
export function strictObject(input: unknown, allowed: string[], required = allowed): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("INVALID_ARGUMENT");
  const value = input as Record<string,unknown>;
  if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value,key))) throw Error("INVALID_ARGUMENT");
  return value;
}
export type UpdateInstanceArguments = {projectId:string;instanceId:string;expectedRevision:number;changes:Partial<Pick<StructureProject["instances"][number],"parameters"|"position"|"rotation">>};
export function parseToolArguments(tool: StructureTool, input: unknown) {
  if (JSON.stringify(input)?.length > 2_000_000) throw Error("INVALID_ARGUMENT");
  const value = strictObject(input, tool === "get_project" ? ["projectId"] : tool === "update_instance" ? ["projectId","instanceId","expectedRevision","changes"] : ["projectId","document"]);
  if (typeof value.projectId !== "string" || !new RegExp(projectId.pattern).test(value.projectId)) throw Error("INVALID_ARGUMENT");
  if (tool === "update_instance") {
    if (typeof value.instanceId !== "string" || !value.instanceId.trim() || value.instanceId.length>200 || !Number.isInteger(value.expectedRevision) || (value.expectedRevision as number)<1 || (value.expectedRevision as number)>2147483646) throw Error("INVALID_ARGUMENT");
    const changes = strictObject(value.changes,["parameters","position","rotation"],[]);
    if (!Object.keys(changes).length) throw Error("INVALID_ARGUMENT");
    // Validate a full disposable project through the same parser, including odd dimensions.
    const probe = {formatVersion:1,id:"probe",name:"probe",revision:0,definitions:[],instances:[]} as StructureProject;
    // Individual changes are parsed below using a known-good instance.
    const parameters = defaultStoneRoomParameters();
    probe.definitions=[{id:"room",generator:"room.stone_basic.v1",parameters}];
    probe.instances=[{id:"room",definitionId:"room",parameters,position:{x:0,y:0,z:0},rotation:0,...changes} as StructureProject["instances"][number]];
    const parsed = parseProject(probe); assertMaterials(parsed);
    return value as unknown as UpdateInstanceArguments;
  }
  return value;
}
export function assertMaterials(project: StructureProject) {
  for (const item of [...project.definitions,...project.instances]) for (const state of [item.parameters.wall,item.parameters.floor,item.parameters.ceiling]) {
    if (!SUPPORTED_MATERIALS.includes(state.id) || Object.keys(state.properties).length) throw Error("UNSUPPORTED_MATERIAL");
  }
}
export function validateStructure(input: unknown, id: string) {
  try {
    const project = deserializeProject(JSON.stringify(input));
    if (project.id !== id) throw Error("INVALID_STRUCTURE");
    try { assertMaterials(project); } catch { return {valid:false,diagnostics:[{code:"UNSUPPORTED_MATERIAL",message:"Используйте семь материалов редактора без свойств блока."}],cellCount:0,conflictCount:0}; }
    const geometry = generateProject(project);
    return {valid:geometry.conflicts.length===0, diagnostics:geometry.conflicts.length ? [{code:"OVERLAP",message:"Комнаты пересекаются."}] : [],cellCount:geometry.cells.length,conflictCount:geometry.conflicts.length};
  } catch { return {valid:false,diagnostics:[{code:"INVALID_STRUCTURE",message:"Некорректный проект: проверьте формат, поля, размеры, ссылки и лимиты ядра."}],cellCount:0,conflictCount:0}; }
}
