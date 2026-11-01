import {readSchematic} from './helpers/schematic-reader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encodeSchematic, exportStructureSchematic } from '../.test-build/server/structure-schematic.js';
import { createStoneRoomProject, generateProject } from '../.test-build/structure-core/index.js';
test('gzip Sponge v3 root, explicit version, full default room and no caller mutation',()=>{
  const p=createStoneRoomProject('p','r'), before=structuredClone(p), bytes=exportStructureSchematic(p).bytes,s=readSchematic(bytes);
  assert.equal(s.Version,3);assert.equal(s.DataVersion,4325);assert.deepEqual([s.Width,s.Height,s.Length],[11,8,11]);
  assert.deepEqual(s.Blocks.BlockEntities,[],'explicit empty list for WorldEdit 7.3.0 compatibility');
  assert.equal(s.at(0,0,0),'minecraft:stone_bricks');assert.equal(s.at(5,4,5),'minecraft:air');assert.deepEqual(p,before);
});
test('rectangular rotations, negative bounds, all doors, every palette index and material',()=>{
  for(const rotation of [0,90,180,270]) {
    const p=createStoneRoomProject('p','r'),i=p.instances[0];
    Object.assign(i.parameters,{width:5,length:9,height:6});Object.keys(i.parameters.doors).forEach(k=>i.parameters.doors[k]=true);
    i.parameters.floor.id='minecraft:oak_planks';i.parameters.ceiling.id='minecraft:quartz_block';
    i.rotation=rotation;i.position={x:-27,y:-8,z:-12};
    const cells=generateProject(p).cells,s=readSchematic(exportStructureSchematic(p).bytes);
    const min=['x','y','z'].map(k=>Math.min(...cells.map(c=>c.position[k])));assert.deepEqual(s.Offset,min);
    assert.deepEqual([s.Width,s.Height,s.Length],rotation%180 ? [9,6,5] : [5,6,9]);
    for(const c of cells) assert.equal(s.at(c.position.x,c.position.y,c.position.z),c.kind==='air'?'minecraft:air':c.state.id);
    assert.equal(cells.filter(c=>c.kind==='air').length,132);
  }
});
test('explicit void and sparse gaps never become air; transformed room gaps stay protected',()=>{
  const s=readSchematic(encodeSchematic([{position:{x:-1,y:0,z:0},kind:'solid',state:{id:'minecraft:stone',properties:{}}},{position:{x:1,y:0,z:0},kind:'void'},{position:{x:2,y:0,z:0},kind:'air'}]).bytes);
  assert.equal(s.at(-1,0,0),'minecraft:stone');assert.equal(s.at(0,0,0),'minecraft:structure_void');assert.equal(s.at(1,0,0),'minecraft:structure_void');assert.equal(s.at(2,0,0),'minecraft:air');
  const p=createStoneRoomProject('p','r');p.instances.push({...structuredClone(p.instances[0]),id:'r2',position:{x:13,y:0,z:0}});
  assert.equal(readSchematic(exportStructureSchematic(p).bytes).at(11,1,1),'minecraft:structure_void');
});
test('sorted block properties and multi-byte VarInts at palette indices 127/128/255/256',()=>{
  const cells=Array.from({length:260},(_,x)=>({position:{x,y:0,z:0},kind:'solid',state:{id:`test:block_${x}`,properties:{z:'one',a:'two'}}}));
  const s=readSchematic(encodeSchematic(cells).bytes);
  for(let x=0;x<260;x++) assert.equal(s.at(x,0,0),`test:block_${x}[a=two,z=one]`);
});
test('empty, conflicts, geometry budget, dense bounding budget and unsigned-short bounds',()=>{
  const p=createStoneRoomProject('p','r');assert.throws(()=>exportStructureSchematic({...p,instances:[]}),/комнату/);
  assert.throws(()=>exportStructureSchematic({...p,instances:[...p.instances,{...p.instances[0],id:'r2'}]}),/пересекаются/);
  p.instances[0].parameters.width=129;p.instances[0].parameters.length=129;p.instances[0].parameters.height=128;
  assert.throws(()=>exportStructureSchematic(p),/лимит/);
  const cell=x=>({position:{x,y:0,z:0},kind:'air'});
  assert.equal(readSchematic(encodeSchematic([cell(0),cell(65534)]).bytes).Width,65535);
  assert.throws(()=>encodeSchematic([cell(0),cell(65535)]),/65 535/);
  assert.equal(readSchematic(encodeSchematic([cell(0),{position:{x:499,y:499,z:0},kind:'air'}]).bytes).Blocks.Data.length,250000);
  assert.throws(()=>encodeSchematic([cell(0),{position:{x:500,y:500,z:0},kind:'air'}]),/250 000/);
  assert.throws(()=>encodeSchematic([cell(0),cell(0)]),/Пересечение/);
  assert.throws(()=>encodeSchematic([cell(0.1)]),/координаты/);
});
test('project API never accepts unknown material/properties, NBT, code or extra fields',()=>{
  const p=createStoneRoomProject('p','r');
  for(const id of ['mod:unknown','minecraft:command_block']) {p.instances[0].parameters.wall.id=id;assert.throws(()=>exportStructureSchematic(p),/семь материалов/);}
  p.instances[0].parameters.wall={id:'minecraft:stone',properties:{facing:'north'}};assert.throws(()=>exportStructureSchematic(p),/семь материалов/);
  assert.throws(()=>exportStructureSchematic({...p,NBT:{Command:'say no'}}),/поля/);
});
test('routes: anonymous snapshot, bounded body, origin, ownership via session/service, no writes',async()=>{
  const require=createRequire(import.meta.url),p=createStoneRoomProject('p','r');let identity=null;
  const authPath=require.resolve('../.test-build/server/auth.js');require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{getAuthUser:async()=>identity}};
  require('../.test-build/server/db.js').getSql=()=>async(strings,...values)=>{
    const q=strings.join('?').trim();if(q.startsWith('create '))return [];
    assert.match(q,/select \*/);assert.match(q,/user_id =/);return values[1]==='alice' ? [{document:p,updated_at:'now'}] : [];
  };
  const local=require('../.test-build/api/structures/export/route.js'), saved=require('../.test-build/api/structures/[id]/export/route.js');
  const req=(body,headers={})=>new Request('https://test/api/structures/export',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  const good=await local.POST(req({document:p}));assert.equal(good.status,200);assert.match(good.headers.get('content-disposition'),/\.schem/);assert.equal(good.headers.get('cache-control'),'private, no-store');readSchematic(Buffer.from(await good.arrayBuffer()));
  assert.equal((await local.POST(req({document:p,nbt:{}}))).status,400);
  assert.equal((await local.POST(req({document:p},{origin:'https://other'}))).status,403);
  assert.equal((await local.POST(req({document:p},{'content-type':'text/plain'}))).status,415);
  assert.equal((await local.POST(req({document:'x'.repeat(2000001)}))).status,413);
  const request=new Request('https://test/api/structures/12345678-1234-4234-8234-123456789abc/export'),context={params:Promise.resolve({id:'12345678-1234-4234-8234-123456789abc'})};
  assert.equal((await saved.GET(request,context)).status,401);
  identity={id:'bob'};assert.equal((await saved.GET(request,context)).status,404);
  identity={id:'alice'};const own=await saved.GET(request,context);assert.equal(own.status,200);readSchematic(Buffer.from(await own.arrayBuffer()));
});
