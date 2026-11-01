/** Persist definitions and instances, never the generated block volume. */
export type Vec3 = { x: number; y: number; z: number };
export type Rotation = 0 | 90 | 180 | 270;
export type Direction = "north" | "east" | "south" | "west";
export type BlockState = { id: string; properties: Record<string, string> };
export type Cell = { position: Vec3 } & (
  | { kind: "solid"; state: BlockState }
  | { kind: "air" }
  | { kind: "void" }
);
export type ConnectionPort = {
  id: Direction; position: Vec3; direction: Direction;
  width: number; height: number; compatibility: "doorway";
};
export type StoneRoomParameters = {
  width: number; length: number; height: number; wallThickness: 1;
  wall: BlockState; floor: BlockState; ceiling: BlockState;
  doors: Record<Direction, boolean>;
};
export type ModuleDefinition = {
  id: string; generator: "room.stone_basic.v1"; parameters: StoneRoomParameters;
};
export type ModuleInstance = {
  id: string; definitionId: string; parameters: StoneRoomParameters;
  position: Vec3; rotation: Rotation;
};
export type StructureProject = {
  formatVersion: 1; id: string; name: string; revision: number;
  definitions: ModuleDefinition[]; instances: ModuleInstance[];
};
export type Geometry = { cells: Cell[]; ports: ConnectionPort[] };
export type GeometryGenerator<P> = (parameters: P) => Geometry;
