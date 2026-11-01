import type { BlockState, Cell, ConnectionPort, Direction, Geometry, ModuleInstance, Rotation, StoneRoomParameters, StructureProject, Vec3 } from "./types";
export type * from "./types";

export const ROOM_GENERATOR = "room.stone_basic.v1" as const;
export const MAX_PROJECT_CELLS = 250_000;
const directions: Direction[] = ["north", "east", "south", "west"];
const blockId = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("Ожидается объект");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(result, key))) throw Error(`Ожидаются поля: ${keys.join(", ")}`);
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw Error(`Ожидается целое число ${min}…${max}`);
  return value;
}
function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw Error("Некорректное имя или ID");
  return value;
}
export function parseBlockState(value: unknown): BlockState {
  const input = object(value, ["id", "properties"]);
  if (typeof input.id !== "string" || !blockId.test(input.id) || ["minecraft:air", "minecraft:cave_air", "minecraft:void_air", "minecraft:structure_void"].includes(input.id)) throw Error("Некорректный ID твёрдого блока");
  if (!input.properties || typeof input.properties !== "object" || Array.isArray(input.properties)) throw Error("Некорректные свойства блока");
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.properties)) {
    if (!/^[a-z0-9_]+$/.test(key) || typeof value !== "string" || !/^[a-z0-9_]+$/.test(value) || key === "__proto__") throw Error("Некорректное свойство блока");
    Object.defineProperty(properties, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return { id: input.id, properties };
}
export function defaultStoneRoomParameters(): StoneRoomParameters {
  const stone = (): BlockState => ({ id: "minecraft:stone_bricks", properties: {} });
  return { width: 11, length: 11, height: 8, wallThickness: 1, wall: stone(), floor: stone(), ceiling: stone(), doors: { north: false, east: false, south: false, west: false } };
}
export function parseStoneRoomParameters(value: unknown): StoneRoomParameters {
  const p = object(value, ["width", "length", "height", "wallThickness", "wall", "floor", "ceiling", "doors"]);
  const width = integer(p.width, 5, 129), length = integer(p.length, 5, 129), height = integer(p.height, 6, 128);
  if (width % 2 === 0 || length % 2 === 0) throw Error("Ширина и длина должны быть нечётными");
  if (width * length * height > MAX_PROJECT_CELLS) throw Error("Превышен лимит геометрии");
  if (p.wallThickness !== 1) throw Error("Поддерживается толщина стены 1");
  const doors = object(p.doors, directions);
  for (const direction of directions) if (typeof doors[direction] !== "boolean") throw Error("Состояние двери должно быть boolean");
  return { width, length, height, wallThickness: 1, wall: parseBlockState(p.wall), floor: parseBlockState(p.floor), ceiling: parseBlockState(p.ceiling), doors: { north: doors.north as boolean, east: doors.east as boolean, south: doors.south as boolean, west: doors.west as boolean } };
}
export function generateStoneRoom(input: StoneRoomParameters): Geometry {
  const p = parseStoneRoomParameters(input), cells: Cell[] = [], ports: ConnectionPort[] = [];
  const cx = (p.width - 1) / 2, cz = (p.length - 1) / 2;
  for (let y = 0; y < p.height; y++) for (let z = 0; z < p.length; z++) for (let x = 0; x < p.width; x++) {
    const position = { x, y, z };
    const opening = y >= 1 && y <= 4 && (
      (p.doors.north && z === 0 && Math.abs(x - cx) <= 1) ||
      (p.doors.south && z === p.length - 1 && Math.abs(x - cx) <= 1) ||
      (p.doors.west && x === 0 && Math.abs(z - cz) <= 1) ||
      (p.doors.east && x === p.width - 1 && Math.abs(z - cz) <= 1));
    const state = y === 0 ? p.floor : y === p.height - 1 ? p.ceiling : !opening && (x === 0 || z === 0 || x === p.width - 1 || z === p.length - 1) ? p.wall : null;
    cells.push(state ? { position, kind: "solid", state: { id: state.id, properties: { ...state.properties } } } : { position, kind: "air" });
  }
  const positions: Record<Direction, Vec3> = { north: { x: cx, y: 1, z: 0 }, east: { x: p.width - 1, y: 1, z: cz }, south: { x: cx, y: 1, z: p.length - 1 }, west: { x: 0, y: 1, z: cz } };
  for (const direction of directions) if (p.doors[direction]) ports.push({ id: direction, position: positions[direction], direction, width: 3, height: 4, compatibility: "doorway" });
  return { cells, ports };
}
function parseRotation(value: unknown): Rotation {
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) throw Error("Поворот должен быть 0, 90, 180 или 270");
  return value;
}
function parsePosition(value: unknown): Vec3 {
  const p = object(value, ["x", "y", "z"]);
  return { x: integer(p.x, -30_000_000, 30_000_000), y: integer(p.y, -30_000_000, 30_000_000), z: integer(p.z, -30_000_000, 30_000_000) };
}
/** Clockwise when viewed from above: north (-Z) becomes east (+X). Pivot is local origin. */
export function transformPosition(input: Vec3, rotation: Rotation, translation: Vec3): Vec3 {
  const p = parsePosition(input), t = parsePosition(translation), turns = parseRotation(rotation) / 90;
  let { x, z } = p;
  for (let i = 0; i < turns; i++) [x, z] = [-z, x];
  return { x: x + t.x, y: p.y + t.y, z: z + t.z };
}
function rotateDirection(direction: Direction, rotation: Rotation): Direction {
  return directions[(directions.indexOf(direction) + rotation / 90) % 4];
}
/** Initial rotation support: facing, axis, numeric rotation, cardinal connections.
 * Rail shapes/orientations are rejected rather than silently exported incorrectly. */
export function rotateBlockState(input: BlockState, rotation: Rotation): BlockState {
  const state = parseBlockState(input); parseRotation(rotation);
  if (!rotation) return state;
  const p = state.properties;
  if (p.shape || p.orientation) throw Error("Поворот shape/orientation пока не поддерживается");
  const properties = { ...p };
  if (p.facing && directions.includes(p.facing as Direction)) properties.facing = rotateDirection(p.facing as Direction, rotation);
  if (p.axis && rotation % 180 && ["x", "z"].includes(p.axis)) properties.axis = p.axis === "x" ? "z" : "x";
  if (p.rotation !== undefined) properties.rotation = String((integer(Number(p.rotation), 0, 15) + rotation / 90 * 4) % 16);
  for (const d of directions) delete properties[d];
  for (const d of directions) if (p[d] !== undefined) properties[rotateDirection(d, rotation)] = p[d];
  return { id: state.id, properties };
}
export function generateInstance(instance: ModuleInstance): Geometry {
  const local = generateStoneRoom(instance.parameters);
  return {
    cells: local.cells.map(cell => cell.kind === "solid" ? { ...cell, position: transformPosition(cell.position, instance.rotation, instance.position), state: rotateBlockState(cell.state, instance.rotation) } : { ...cell, position: transformPosition(cell.position, instance.rotation, instance.position) }),
    ports: local.ports.map(port => ({ ...port, position: transformPosition(port.position, instance.rotation, instance.position), direction: rotateDirection(port.direction, instance.rotation) })),
  };
}
export function parseProject(value: unknown): StructureProject {
  const p = object(value, ["formatVersion", "id", "name", "revision", "definitions", "instances"]);
  if (p.formatVersion !== 1) throw Error("Неподдерживаемая версия проекта");
  if (!Array.isArray(p.definitions) || !Array.isArray(p.instances) || p.definitions.length > 100 || p.instances.length > 100) throw Error("Некорректный список модулей");
  const definitions = p.definitions.map(value => {
    const d = object(value, ["id", "generator", "parameters"]);
    if (d.generator !== ROOM_GENERATOR) throw Error("Неизвестный генератор");
    return { id: label(d.id), generator: ROOM_GENERATOR, parameters: parseStoneRoomParameters(d.parameters) };
  });
  const definitionIds = new Set(definitions.map(d => d.id));
  if (definitionIds.size !== definitions.length) throw Error("Повторяющийся ID определения");
  let volume = 0;
  const instances = p.instances.map(value => {
    const i = object(value, ["id", "definitionId", "parameters", "position", "rotation"]);
    const definitionId = label(i.definitionId);
    if (!definitionIds.has(definitionId)) throw Error("Определение модуля не найдено");
    const parameters = parseStoneRoomParameters(i.parameters);
    volume += parameters.width * parameters.length * parameters.height;
    return { id: label(i.id), definitionId, parameters, position: parsePosition(i.position), rotation: parseRotation(i.rotation) };
  });
  if (volume > MAX_PROJECT_CELLS) throw Error("Превышен лимит геометрии проекта");
  if (new Set(instances.map(i => i.id)).size !== instances.length) throw Error("Повторяющийся ID экземпляра");
  return { formatVersion: 1, id: label(p.id), name: label(p.name), revision: integer(p.revision, 0, Number.MAX_SAFE_INTEGER), definitions, instances };
}
export function serializeProject(project: StructureProject): string { return JSON.stringify(parseProject(project)); }
export function deserializeProject(json: string): StructureProject {
  if (json.length > 2_000_000) throw Error("Слишком большой проект");
  return parseProject(JSON.parse(json));
}
export function createStoneRoomProject(id: string, instanceId: string): StructureProject {
  return parseProject({ formatVersion: 1, id, name: "Каменная комната", revision: 0,
    definitions: [{ id: ROOM_GENERATOR, generator: ROOM_GENERATOR, parameters: defaultStoneRoomParameters() }],
    instances: [{ id: instanceId, definitionId: ROOM_GENERATOR, parameters: defaultStoneRoomParameters(), position: { x: 0, y: 0, z: 0 }, rotation: 0 }],
  });
}
/** All overlaps are reported, including air against solid; no implicit last writer wins. */
export function generateProject(input: StructureProject) {
  const project = parseProject(input), cells = new Map<string, Cell>();
  const conflicts: { position: Vec3; firstInstanceId: string; secondInstanceId: string }[] = [];
  const owners = new Map<string, string>();
  for (const instance of project.instances) for (const cell of generateInstance(instance).cells) {
    if (cell.kind === "void") continue;
    const key = `${cell.position.x},${cell.position.y},${cell.position.z}`;
    if (cells.has(key)) conflicts.push({ position: cell.position, firstInstanceId: owners.get(key)!, secondInstanceId: instance.id });
    else { cells.set(key, cell); owners.set(key, instance.id); }
  }
  return { cells: [...cells.values()], conflicts };
}
