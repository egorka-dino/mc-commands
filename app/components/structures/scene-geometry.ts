import type { Cell, Vec3 } from "../../structure-core";

// Only opaque full cubes are exposed by this iteration's UI.
export const MATERIALS = [
  { id: "minecraft:stone_bricks", label: "Каменные кирпичи", color: "#939a9f" },
  { id: "minecraft:stone", label: "Камень", color: "#81888c" },
  { id: "minecraft:cobblestone", label: "Булыжник", color: "#697278" },
  { id: "minecraft:deepslate_bricks", label: "Глубинносланцевые кирпичи", color: "#454957" },
  { id: "minecraft:oak_planks", label: "Дубовые доски", color: "#ba935d" },
  { id: "minecraft:bricks", label: "Кирпичи", color: "#b56c53" },
  { id: "minecraft:quartz_block", label: "Кварцевый блок", color: "#e5dfcf" },
] as const;
const key = ({ x, y, z }: Vec3) => `${x},${y},${z}`;
const section = ({ x, y, z }: Vec3) => `${Math.floor(x / 16)},${Math.floor(y / 16)},${Math.floor(z / 16)}`;
const faces = [
  { n: [1,0,0], corners: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
  { n: [-1,0,0], corners: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
  { n: [0,1,0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0,-1,0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0,0,1], corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { n: [0,0,-1], corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
];
export type Surface = { material: string; positions: number[]; normals: number[]; shades: number[] };
export type SectionSurface = { origin: Vec3; surfaces: Surface[] };
type Solid = Extract<Cell, { kind: "solid" }>;
const signature = (c: Solid) => JSON.stringify([c.state.id, Object.entries(c.state.properties).sort()]);

/** Keeps unaffected section payloads by identity; changed cells invalidate both sides of every face. */
export class SectionMesher {
  private solids = new Map<string, Solid>();
  readonly sections = new Map<string, SectionSurface>();
  update(cells: Cell[]): Set<string> {
    const next = new Map(cells.filter((c): c is Solid => c.kind === "solid").map(c => [key(c.position), c]));
    const dirty = new Set<string>();
    const invalidate = (p: Vec3) => {
      dirty.add(section(p));
      for (const { n } of faces) dirty.add(section({ x: p.x+n[0], y: p.y+n[1], z: p.z+n[2] }));
    };
    for (const [k, c] of this.solids) if (!next.has(k) || signature(c) !== signature(next.get(k)!)) invalidate(c.position);
    for (const [k, c] of next) if (!this.solids.has(k)) invalidate(c.position);
    const buckets = new Map<string, Solid[]>();
    for (const c of next.values()) {
      const s = section(c.position);
      if (dirty.has(s)) { const bucket = buckets.get(s) ?? []; bucket.push(c); buckets.set(s, bucket); }
    }
    for (const s of dirty) {
      const bucket = buckets.get(s);
      if (!bucket) { this.sections.delete(s); continue; }
      const [sx,sy,sz] = s.split(",").map(Number);
      const origin = { x:sx*16, y:sy*16, z:sz*16 }, groups = new Map<string, Surface>();
      for (const c of bucket) for (const f of faces) {
        const p = c.position;
        if (next.has(key({ x:p.x+f.n[0], y:p.y+f.n[1], z:p.z+f.n[2] }))) continue;
        let group = groups.get(c.state.id);
        if (!group) { group = { material:c.state.id, positions:[], normals:[], shades:[] }; groups.set(c.state.id, group); }
        const shade = ((p.x+p.y+p.z)%2 === 0 ? 1 : 0.92);
        for (const i of [0,1,2,0,2,3]) {
          const v = f.corners[i];
          group.positions.push(p.x-origin.x+v[0], p.y-origin.y+v[1], p.z-origin.z+v[2]);
          group.normals.push(...f.n); group.shades.push(shade,shade,shade);
        }
      }
      this.sections.set(s, { origin, surfaces:[...groups.values()] });
    }
    this.solids = next;
    return dirty;
  }
}

/** Horizontal movement remains normalized even while looking straight up/down. */
export function flightStep(keys: ReadonlySet<string>, yaw: number, speed: number, delta: number): Vec3 {
  let x = Number(keys.has("KeyD"))-Number(keys.has("KeyA"));
  let z = Number(keys.has("KeyS"))-Number(keys.has("KeyW"));
  let y = Number(keys.has("Space"))-Number(keys.has("ShiftLeft") || keys.has("ShiftRight"));
  const scale = speed * Math.min(Math.max(delta,0),0.05) / (Math.hypot(x,y,z) || 1);
  x *= scale; y *= scale; z *= scale;
  return { x:x*Math.cos(yaw)+z*Math.sin(yaw), y, z:-x*Math.sin(yaw)+z*Math.cos(yaw) };
}
