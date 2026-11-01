import assert from 'node:assert/strict';
import test from 'node:test';
import { SectionMesher, flightStep } from '../.test-build/components/structures/scene-geometry.js';
import { createStoneRoomProject, generateProject } from '../.test-build/structure-core/index.js';
const solid=(x,y,z,id='minecraft:stone') => ({kind:'solid',position:{x,y,z},state:{id,properties:{}}});
const count=mesher => [...mesher.sections.values()].reduce((n,s) => n+s.surfaces.reduce((n,g) => n+g.positions.length/18,0),0);
test('adjacent cubes share no internal faces, including across material and section boundaries', () => {
  for (const x of [0,15,-1]) {
    const m=new SectionMesher(); m.update([solid(x,0,0),solid(x+1,0,0,'minecraft:bricks')]);
    assert.equal(count(m),10);
    m.update([solid(x,0,0)]); assert.equal(count(m),6);
    m.update([]); assert.equal(m.sections.size,0);
  }
});
test('triangles face outward and normals match their winding', () => {
  const m=new SectionMesher(); m.update([solid(0,0,0)]);
  for (const s of m.sections.values()) for (const g of s.surfaces) {
    for (let i=0;i<g.positions.length;i+=9) {
      const p=g.positions.slice(i,i+9), n=g.normals.slice(i,i+3);
      const a=[p[3]-p[0],p[4]-p[1],p[5]-p[2]], b=[p[6]-p[0],p[7]-p[1],p[8]-p[2]];
      assert.deepEqual([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(v=>v || 0),n);
    }
  }
});
test('negative section coordinates stay local; untouched sections keep their payload', () => {
  const m=new SectionMesher(), cells=[solid(-1,-1,-1),solid(100,0,0)]; m.update(cells);
  const untouched=m.sections.get('6,0,0');
  assert.deepEqual(m.sections.get('-1,-1,-1').origin,{x:-16,y:-16,z:-16});
  assert.ok(m.sections.get('-1,-1,-1').surfaces[0].positions.every(n=>n>=15 && n<=16));
  assert.equal(m.update(cells).size,0);
  const dirty=m.update([solid(-1,-1,-1,'minecraft:bricks'),cells[1]]);
  assert.ok(dirty.has('0,-1,-1')); assert.equal(m.sections.get('6,0,0'),untouched);
});
test('room includes inner surfaces and doorways, geometry follows core transform', () => {
  const p=createStoneRoomProject('p','r'); const m=new SectionMesher();
  m.update(generateProject(p).cells);
  // Exterior 2*(11*11+11*8+11*8), interior 2*(9*9+9*6+9*6).
  assert.equal(count(m),2*(121+88+88)+2*(81+54+54));
  p.instances[0].parameters.doors.north=true;
  p.instances[0].rotation=90; p.instances[0].position={x:-30,y:20,z:8};
  m.update(generateProject(p).cells);
  assert.ok([...m.sections.values()].every(s=>s.origin.x<0 && s.origin.y>=16));
  assert.ok(count(m)>0);
});
test('air/void produce no geometry; movement is horizontal, normalized and time based', () => {
  const m=new SectionMesher(); m.update([{kind:'air',position:{x:0,y:0,z:0}},{kind:'void',position:{x:1,y:0,z:0}}]);
  assert.equal(count(m),0);
  const forward=flightStep(new Set(['KeyW']),0,10,.02); assert.deepEqual(forward,{x:0,y:0,z:-.2});
  const east=flightStep(new Set(['KeyW']),-Math.PI/2,10,.02); assert.ok(Math.abs(east.x-.2)<1e-10);
  const diagonal=flightStep(new Set(['KeyW','KeyD','Space']),0,10,.02); assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y,diagonal.z)-.2)<1e-10);
  assert.deepEqual(flightStep(new Set(),0,60,10),{x:0,y:0,z:0});
  assert.equal(flightStep(new Set(['Space']),0,10,5).y,.5);
  assert.equal(flightStep(new Set(['ShiftRight']),0,10,.02).y,-.2);
});
