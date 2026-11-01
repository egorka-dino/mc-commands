import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoneRoomProject, defaultStoneRoomParameters, generateStoneRoom, generateInstance, generateProject, parseProject, parseBlockState, rotateBlockState, transformPosition, serializeProject, deserializeProject } from '../.test-build/structure-core/index.js';

const at = (geometry, x, y, z) => geometry.cells.find(c => c.position.x === x && c.position.y === y && c.position.z === z);
const key = c => `${c.position.x},${c.position.y},${c.position.z}`;
test('11×11×8 room contains exactly the specified shell and interior', () => {
  const room = generateStoneRoom(defaultStoneRoomParameters());
  assert.equal(room.cells.length, 968);
  assert.equal(new Set(room.cells.map(key)).size, 968);
  assert.equal(room.cells.filter(c => c.kind === 'solid').length, 482);
  assert.equal(room.cells.filter(c => c.kind === 'air').length, 486);
  for (const c of room.cells) {
    const {x,y,z} = c.position;
    assert.equal(c.kind, x === 0 || x === 10 || y === 0 || y === 7 || z === 0 || z === 10 ? 'solid' : 'air');
  }
  assert.deepEqual(room.ports, []);
});
test('all 16 combinations carve only independently enabled 3×4 doorways', () => {
  const directions = ['north', 'east', 'south', 'west'];
  for (let mask = 0; mask < 16; mask++) {
    const p = defaultStoneRoomParameters();
    directions.forEach((d, i) => p.doors[d] = !!(mask & (1 << i)));
    const room = generateStoneRoom(p);
    const enabled = directions.filter(d => p.doors[d]);
    assert.equal(room.cells.filter(c => c.kind === 'solid').length, 482 - 12 * enabled.length);
    assert.deepEqual(room.ports.map(p => p.id).sort(), enabled.sort());
    for (let y = 1; y <= 6; y++) for (let t = 1; t <= 9; t++) {
      for (const [d,x,z] of [['north',t,0],['south',t,10],['west',0,t],['east',10,t]]) {
        assert.equal(at(room,x,y,z).kind, p.doors[d] && y <= 4 && t >= 4 && t <= 6 ? 'air' : 'solid');
      }
    }
    for (const port of room.ports) {
      assert.equal(port.width, 3); assert.equal(port.height, 4);
      assert.equal(at(room, port.position.x, port.position.y, port.position.z).kind, 'air');
    }
  }
});
test('resizing regenerates geometry, keeps doors centered and separates materials', () => {
  const p = defaultStoneRoomParameters();
  Object.assign(p, {width:15, length:21, height:10});
  p.doors.east = true;
  p.wall.id = 'minecraft:deepslate_bricks'; p.floor.id = 'minecraft:oak_planks';
  const room = generateStoneRoom(p);
  assert.equal(room.cells.length, 3150);
  assert.equal(at(room,14,4,10).kind, 'air');
  assert.equal(at(room,14,5,10).state.id, 'minecraft:deepslate_bricks');
  assert.equal(at(room,7,0,10).state.id, 'minecraft:oak_planks');
  assert.equal(at(room,7,9,10).state.id, 'minecraft:stone_bricks');
  assert.equal(generateStoneRoom(defaultStoneRoomParameters()).cells.length, 968);
});
test('quarter turns transform rectangular rooms and ports around local origin', () => {
  const instance = createStoneRoomProject('p','room').instances[0];
  instance.parameters.length = 15; instance.parameters.doors.north = true;
  instance.position = {x:20,y:-4,z:30};
  for (const [rotation, direction, corner] of [[0,'north',[30,3,44]],[90,'east',[6,3,40]],[180,'south',[10,3,16]],[270,'west',[34,3,20]]]) {
    instance.rotation = rotation;
    const geometry = generateInstance(instance);
    assert.equal(new Set(geometry.cells.map(key)).size, 11 * 15 * 8);
    assert.equal(geometry.ports[0].direction, direction);
    assert.equal(geometry.ports[0].id, 'north');
    assert.equal(at(geometry,...corner).kind, 'solid');
    const pos = geometry.ports[0].position;
    assert.equal(at(geometry,pos.x,pos.y,pos.z).kind, 'air');
  }
  let p = {x:2,y:3,z:7};
  for (let i=0;i<4;i++) p=transformPosition(p,90,{x:0,y:0,z:0});
  assert.deepEqual(p,{x:2,y:3,z:7});
});
test('block state rotates supported directional properties without mutating input', () => {
  const state = {id:'minecraft:oak_log',properties:{axis:'x',facing:'north',rotation:'15',north:'low',west:'none'}};
  const rotated = rotateBlockState(state,90);
  assert.deepEqual(rotated.properties,{axis:'z',facing:'east',rotation:'3',east:'low',north:'none'});
  assert.equal(state.properties.facing,'north');
  assert.throws(()=>rotateBlockState({id:'minecraft:rail',properties:{shape:'north_south'}},90),/не поддерживается/);
});
test('JSON round trip preserves IDs, parameters and exact regenerated geometry', () => {
  const project = createStoneRoomProject('castle','entry');
  project.instances[0].parameters.height = 10;
  project.instances[0].parameters.doors.east = true;
  project.instances[0].rotation = 270;
  const json = serializeProject(project), restored = deserializeProject(json);
  assert.deepEqual(restored,project);
  assert.deepEqual(generateProject(restored),generateProject(project));
  assert.ok(!json.includes('cells'));
  restored.instances[0].parameters.wall.id='minecraft:dirt';
  assert.equal(project.instances[0].parameters.wall.id,'minecraft:stone_bricks');
});
test('untrusted project data fails explicitly rather than coercing or dropping fields', () => {
  for (const mutate of [p=>p.formatVersion=2,p=>p.revision=-1,p=>p.instances[0].rotation=45,
    p=>p.instances[0].definitionId='missing',p=>p.instances.push(structuredClone(p.instances[0])),
    p=>p.definitions.push(structuredClone(p.definitions[0])),p=>p.extra=true,
    p=>p.definitions[0].generator='javascript',p=>p.instances[0].position.x=NaN]) {
    const p=createStoneRoomProject('p','i');mutate(p);assert.throws(()=>parseProject(p));
  }
  for (const field of ['width','length','height','wallThickness']) for (const value of [0,-1,1.5,'11',Infinity,NaN,null]) {
    const p=defaultStoneRoomParameters();p[field]=value;assert.throws(()=>generateStoneRoom(p));
  }
  for (const value of [6,130]) {const p=defaultStoneRoomParameters();p.width=value;assert.throws(()=>generateStoneRoom(p));}
  const huge=defaultStoneRoomParameters();Object.assign(huge,{width:129,length:129,height:128});assert.throws(()=>generateStoneRoom(huge),/лимит/);
  const wrongDoor=defaultStoneRoomParameters();wrongDoor.doors.north='true';assert.throws(()=>generateStoneRoom(wrongDoor));
  for (const id of ['stone','minecraft:air','minecraft:structure_void','minecraft:Stone']) assert.throws(()=>parseBlockState({id,properties:{}}));
  assert.throws(()=>deserializeProject('{broken'));
});
test('project volume budget applies to the aggregate of instances',()=>{
  const p=createStoneRoomProject('p','i');
  Object.assign(p.instances[0].parameters,{width:51,length:51,height:60});
  p.instances.push({...structuredClone(p.instances[0]),id:'second'});
  assert.throws(()=>parseProject(p),/лимит/);
});
test('overlap reports owners, including solid against air; separated rooms do not conflict',()=>{
  const p=createStoneRoomProject('p','first');
  p.instances.push({...structuredClone(p.instances[0]),id:'second'});
  const before=serializeProject(p);
  const same=generateProject(p);
  assert.equal(same.conflicts.length,968);
  assert.equal(same.conflicts[0].firstInstanceId,'first');assert.equal(same.conflicts[0].secondInstanceId,'second');
  assert.equal(serializeProject(p),before);
  p.instances[1].position.x=1;
  assert.ok(generateProject(p).conflicts.some(c=>c.position.x===1&&c.position.y===1&&c.position.z===1));
  p.instances[1].position.x=11;
  assert.equal(generateProject(p).conflicts.length,0);
});
