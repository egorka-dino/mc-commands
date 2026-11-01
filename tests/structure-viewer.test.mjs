import assert from 'node:assert/strict';
import test from 'node:test';
import { SectionMesher, flightStep, TEXTURE_NAMES, TEXTURE_VERSION, faceTexture } from '../.test-build/components/structures/scene-geometry.js';
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


test('every face has one upright full-tile UV, including negative coordinates', () => {
  const m=new SectionMesher(); m.update([solid(-1,-1,-1)]);
  for (const section of m.sections.values()) for (const g of section.surfaces) {
    assert.equal(g.uvs.length, g.positions.length/3*2);
    for (let i=0;i<g.uvs.length;i+=12) assert.deepEqual(g.uvs.slice(i,i+12),[0,0,1,0,1,1,0,0,1,1,0,1]);
    assert.equal('shades' in g,false);
    // On vertical faces, the top of the image follows positive Y.
    for (let i=0;i<g.normals.length;i+=3) if (g.normals[i+1]===0) {
      assert.equal(g.uvs[i/3*2+1],g.positions[i+1]-15);
    }
  }
});

test('quartz uses vanilla column ends and sides; bundled textures match pinned hashes', async () => {
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const root=new URL(`../public/structure-textures/${TEXTURE_VERSION}/`,import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root)));
  assert.equal(manifest.minecraft,TEXTURE_VERSION);
  for (const [name,hash] of Object.entries(manifest.files)) {
    const bytes=await readFile(new URL(name,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,name);
    if (name.endsWith('.png')) { assert.equal(bytes.readUInt32BE(16),16); assert.equal(bytes.readUInt32BE(20),16); }
  }
  for (const name of TEXTURE_NAMES) assert.ok(manifest.files[`${name}.png`]);
  const model=JSON.parse(await readFile(new URL('quartz_block.json',root)));
  assert.equal(model.textures.end,`minecraft:block/${faceTexture('minecraft:quartz_block',1)}`);
  assert.equal(faceTexture('minecraft:quartz_block',-1),'quartz_block_top');
  const m=new SectionMesher(); m.update([solid(0,0,0,'minecraft:quartz_block')]);
  assert.deepEqual(m.sections.get('0,0,0').surfaces.map(g=>[g.material,g.positions.length/18]).sort(),[['quartz_block_side',4],['quartz_block_top',2]]);
  assert.equal(faceTexture('example:unknown',0),'missing');
});

test('texture owner handles failure, pixel filtering and cleanup during pending requests', async () => {
  const {createRequire}=await import('node:module');
  const THREE=createRequire(import.meta.url)('three');
  const {createTextureMaterials}=await import('../.test-build/components/structures/texture-materials.js');
  const requests=[]; const original=THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load=function(url,load,progress,error) {
    const texture=new THREE.Texture(); requests.push({url,load,error,texture}); return texture;
  };
  try {
    let failures=[];
    const owner=createTextureMaterials(names=>{failures=names;});
    assert.equal(requests.length,8);
    assert.ok(requests.every(r=>r.url.startsWith(`/structure-textures/${TEXTURE_VERSION}/`)));
    const first=requests[0]; first.load(first.texture);
    assert.equal(first.texture.magFilter,THREE.NearestFilter);
    assert.equal(first.texture.minFilter,THREE.NearestFilter);
    assert.equal(first.texture.colorSpace,THREE.SRGBColorSpace);
    assert.equal(first.texture.generateMipmaps,false);
    requests[1].error(); assert.deepEqual(failures,['stone']);
    assert.equal(owner.materials.get('stone').map,owner.fallback.map);
    let texturesDisposed=0, materialsDisposed=0;
    for (const r of requests) r.texture.addEventListener('dispose',()=>texturesDisposed++);
    for (const m of [...owner.materials.values(),owner.fallback]) m.addEventListener('dispose',()=>materialsDisposed++);
    owner.dispose(); assert.equal(texturesDisposed,8); assert.equal(materialsDisposed,9);
    requests[2].load(requests[2].texture); requests[3].error();
    assert.equal(texturesDisposed,9); assert.deepEqual(failures,['stone']);
  } finally { THREE.TextureLoader.prototype.load=original; }
});
