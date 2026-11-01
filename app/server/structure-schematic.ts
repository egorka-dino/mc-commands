import { gzipSync } from "node:zlib";
import { generateProject, MAX_PROJECT_CELLS, parseBlockState, parseProject } from "../structure-core";
import type { Cell } from "../structure-core";
import { MATERIALS } from "../structure-core/materials";

export const SCHEMATIC_MINECRAFT_VERSION = "1.21.5";
export const SCHEMATIC_DATA_VERSION = 4325;
export class SchematicError extends Error {}
// Only the NBT subset we write. No arbitrary client NBT, entities, or code.
const int = (n:number) => { const b=Buffer.alloc(4); b.writeInt32BE(n); return b; };
const short = (n:number) => { const b=Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const string = (s:string) => { const b=Buffer.from(s,"utf8"); if (b.length>65535) throw new SchematicError("Слишком длинное имя NBT."); return Buffer.concat([short(b.length),b]); };
const tag = (type:number,name:string,payload:Buffer) => Buffer.concat([Buffer.from([type]),string(name),payload]);
const compound = (name:string,children:Buffer[]) => tag(10,name,Buffer.concat([...children,Buffer.from([0])]));
const ints = (name:string,values:number[]) => tag(11,name,Buffer.concat([int(values.length),...values.map(int)]));
function stateName(cell:Cell) {
  if (cell.kind!=="solid") return cell.kind==="air" ? "minecraft:air" : "minecraft:structure_void";
  const state=parseBlockState(cell.state), properties=Object.entries(state.properties).sort(([a],[b])=>a.localeCompare(b));
  return state.id+(properties.length ? `[${properties.map(([k,v])=>`${k}=${v}`).join(",")}]` : "");
}
/** Internal generated-cell adapter, never a route accepting arbitrary cell/NBT payloads. */
export function encodeSchematic(cells:Cell[]) {
  if (!cells.length) throw new SchematicError("Добавьте комнату перед экспортом.");
  if (cells.length>MAX_PROJECT_CELLS) throw new SchematicError("Превышен лимит геометрии.");
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for (const cell of cells) for (const [i,axis] of (["x","y","z"] as const).entries()) {
    const n=cell.position[axis];
    if (!Number.isSafeInteger(n) || Math.abs(n)>30_000_128) throw new SchematicError("Некорректные координаты.");
    min[i]=Math.min(min[i],n); max[i]=Math.max(max[i],n);
  }
  const [width,height,length]=max.map((n,i)=>n-min[i]+1), volume=width*height*length;
  if ([width,height,length].some(n=>n>65535) || volume>MAX_PROJECT_CELLS) throw new SchematicError("Общий объём экспорта превышает 250 000 ячеек или размер 65 535 по оси. Сблизьте комнаты.");
  // The dense file must explicitly protect every sparse gap from a normal WorldEdit paste.
  const palette=new Map<string,number>([["minecraft:structure_void",0]]), indices=new Uint32Array(volume), seen=new Set<number>();
  for (const cell of cells) {
    const {x,y,z}=cell.position, index=x-min[0]+(z-min[2])*width+(y-min[1])*width*length;
    if (seen.has(index)) throw new SchematicError("Пересечение ячеек. Устраните конфликт перед экспортом.");
    seen.add(index);
    const name=stateName(cell);
    if (!palette.has(name)) palette.set(name,palette.size);
    indices[index]=palette.get(name)!;
  }
  const data:number[]=[];
  for (let n of indices) { while (n>=128) { data.push((n&127)|128); n>>>=7; } data.push(n); }
  const nbt=compound("",[compound("Schematic",[
    tag(3,"Version",int(3)),tag(3,"DataVersion",int(SCHEMATIC_DATA_VERSION)),
    tag(2,"Width",short(width)),tag(2,"Height",short(height)),tag(2,"Length",short(length)),ints("Offset",min),
    compound("Metadata",[compound("WorldEdit",[ints("Origin",[0,0,0])])]),
    compound("Blocks",[compound("Palette",[...palette].map(([name,id])=>tag(3,name,int(id)))),tag(7,"Data",Buffer.concat([int(data.length),Buffer.from(data)])),
      // WorldEdit 7.3.0 requests this optional list with getListTag, not findListTag.
      tag(9,"BlockEntities",Buffer.concat([Buffer.from([10]),int(0)])),
    ]),
  ])]);
  return { bytes:gzipSync(nbt), min, max, width, height, length };
}
export function exportStructureSchematic(input:unknown) {
  try {
    const project=parseProject(input);
    // Core syntax validation is version-neutral. Export only version-verified UI materials.
    for (const instance of project.instances) for (const state of [instance.parameters.wall,instance.parameters.floor,instance.parameters.ceiling]) {
      if (!MATERIALS.some(m=>m.id===state.id) || Object.keys(state.properties).length) throw new SchematicError("Экспорт 1.21.5 поддерживает семь материалов редактора без дополнительных свойств.");
    }
    const geometry=generateProject(project);
    if (geometry.conflicts.length) throw new SchematicError("Комнаты пересекаются. Устраните пересечения перед экспортом.");
    return encodeSchematic(geometry.cells);
  } catch (error) {
    if (error instanceof SchematicError) throw error;
    throw new SchematicError(error instanceof Error ? error.message : "Некорректный проект.");
  }
}
export function schematicResponse(input:unknown) {
  const {bytes}=exportStructureSchematic(input);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="structure.schem"',"Cache-Control":"private, no-store",Vary:"Cookie","X-Content-Type-Options":"nosniff"}});
}
