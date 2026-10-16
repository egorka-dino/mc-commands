import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { buildPreviewScene, isPreviewSupported, placePreviewEntity } from '../.test-build/components/summon/preview-scene.js';
import { ALL_MOBS, RANDOM_BABY_MOBS, SLOTS, BANNER_PATTERNS, TRIM_PATTERNS, TRIM_MATERIALS } from '../.test-build/components/summon/data.js';
import { buildSummonCommand, getPreviewData, toSnapshot } from '../.test-build/components/summon/engine.js';
const root = new URL('../public/entity-preview/26.1.2/catalog/',import.meta.url);
const asset = path => JSON.parse(readFileSync(new URL(path,root),'utf8'));

test('export roster exactly matches the editor, including every item and allowed slot',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../tools/entity-export/catalog.json',import.meta.url),'utf8'));
 assert.deepEqual(catalog.entities,Object.keys(ALL_MOBS));
 assert.deepEqual(catalog.babyEntities,[...RANDOM_BABY_MOBS]);
 assert.deepEqual(catalog.slots,SLOTS.map(({key,items})=>({key,items})));
 for(const id of Object.keys(ALL_MOBS))assert.equal(isPreviewSupported(id),true);
 const report=asset('report.json');
 assert.deepEqual(Object.keys(report.entities).sort(),Object.keys(ALL_MOBS).sort());
 assert.equal(Object.keys(report.items).length,new Set(SLOTS.flatMap(s=>s.items)).size);
});

test('every editor selection resolves to an exported pose and item context',()=>{
 for(const id of Object.keys(ALL_MOBS))for(const baby of [false,true]){
  const snapshot=toSnapshot([id]);snapshot.fields['0-baby']=baby;
  const scene=buildPreviewScene(snapshot)[0];const model=asset(`entities/${id}.json`);
  const key=(scene.baby?'baby-':'')+'standing0';assert.ok(model.poses[key],id+key);
  assert.equal(model.poses[key].body.length>0,id!=='area_effect_cloud');
 }
 for(const item of new Set(SLOTS.flatMap(s=>s.items)))for(const context of ['GROUND','THIRD_PERSON_RIGHT_HAND','THIRD_PERSON_LEFT_HAND'])assert.ok(asset(`items/${item}.json`)[context]?.length,item);
});

test('native renderer capabilities govern worn equipment and hand attachments',()=>{
 const pose=id=>asset(`entities/${id}.json`).poses.standing3;
 for(const id of ['horse','ravager','creeper']){
  assert.deepEqual(pose(id).attachments,{});assert.deepEqual(pose(id).equipment.head,{});
 }
 assert.ok(pose('zombie').equipment.chest.elytra);
 assert.ok(pose('zombie').equipment.head.turtle_helmet);
 assert.ok(pose('villager').equipment.head.player_head);
 assert.equal(pose('villager').equipment.head.diamond_helmet,undefined);
 assert.ok(pose('fox').attachments.mainhand);assert.equal(pose('fox').attachments.offhand,undefined);
 assert.equal(pose('vindicator').attachments.mainhand,undefined);
 assert.notDeepEqual(asset('entities/pillager.json').poses['standing1-crossbow'].attachments,asset('entities/pillager.json').poses.standing1.attachments); // Idle, arms crossed.
});

test('horse coats share geometry and update the command',()=>{
 const snapshot=toSnapshot(['horse']);snapshot.fields['0-horse-coat']='4';
 const black=buildPreviewScene(snapshot)[0];assert.equal(black.texture,'horse/horse_black');
 assert.match(buildSummonCommand(snapshot),/Variant:4/);
 snapshot.fields['0-horse-coat']='6';const brown=buildPreviewScene(snapshot)[0];
 assert.equal(brown.model,black.model);assert.equal(brown.texture,'horse/horse_darkbrown');
});

test('scene reads editor state including equipment appearance and passenger order',()=>{
 const snapshot=toSnapshot(['ravager','zombie','skeleton']);
 Object.assign(snapshot.fields,{'1-baby':true,'1-scale':'2','1-slot-chest':'leather_chestplate','1-slot-mainhand':'mace','1-dyeon-chest':true,'1-dye-chest':'#ff0000','1-trimon-chest':true,'1-trimpat-chest':'silence','1-trimmat-chest':'gold','2-slot-mainhand':'trident'});
 const scene=buildPreviewScene(snapshot);
 assert.deepEqual(scene.map(e=>e.riding),[false,true,true]);assert.equal(scene[1].model,'zombie_baby');assert.equal(scene[1].scale,2);
 assert.equal(scene[1].equipment[0].dye,'#ff0000');assert.deepEqual(scene[1].equipment[0].trim,{pattern:'silence',material:'gold'});
 assert.match(buildSummonCommand(snapshot),/Passengers:.*zombie.*Passengers:.*skeleton/);
});

test('visual limits never erase textual characteristics and equipment',()=>{
 const snapshot=toSnapshot(['ravager','area_effect_cloud']);
 Object.assign(snapshot.fields,{'0-slot-mainhand':'shield','0-health':'120','0-scale':'NaN'});
 const scene=buildPreviewScene(snapshot);assert.equal(scene[0].scale,1);assert.equal(scene[0].equipment[0].item,'shield');
 assert.ok(scene[1].warnings.some(w=>w.includes('частиц')));
 assert.ok(getPreviewData(snapshot,0).stats.includes('HP: 120'));assert.equal(getPreviewData(snapshot,0).gear.length,1);
});

test('commands use canonical boat IDs and correct age tags',()=>{
 const snapshot=toSnapshot(['boat','horse']);snapshot.fields['1-baby']=true;
 const command=buildSummonCommand(snapshot);assert.match(command,/^\/summon minecraft:oak_boat /);assert.match(command,/Age:-24000/);assert.doesNotMatch(command,/IsBaby/);
 const zombie=toSnapshot(['zombie']);zombie.fields['0-baby']=true;assert.match(buildSummonCommand(zombie),/IsBaby:1b/);
});

test('banner base color changes the real item ID; shield uses its component',()=>{
 const snapshot=toSnapshot(['zombie']);Object.assign(snapshot.fields,{'0-slot-mainhand':'white_banner','0-shieldon-mainhand':true,'0-shieldbase-mainhand':'purple','0-slot-offhand':'shield','0-shieldon-offhand':true,'0-shieldbase-offhand':'red'});
 assert.match(buildSummonCommand(snapshot),/mainhand:\{id:purple_banner/);
 assert.match(buildSummonCommand(snapshot),/offhand:\{id:shield,.*base_color:"red"/);
 assert.equal(buildPreviewScene(snapshot)[0].equipment[0].banner.base,'purple');
});

test('all dynamic banner masks and armor trim palettes are present',()=>{
 for(const [pattern] of BANNER_PATTERNS)for(const kind of ['banner','shield'])assert.ok(existsSync(new URL(`textures/entity/${kind}/${pattern}.png`,root)),kind+'/'+pattern);
 for(const [pattern] of TRIM_PATTERNS)for(const [material] of TRIM_MATERIALS)for(const layer of ['humanoid','humanoid_leggings']){
  assert.ok(existsSync(new URL(`textures/trims/entity/${layer}/${pattern}_${material}.png`,root)));
  if(['iron','gold','diamond','netherite'].includes(material))assert.ok(existsSync(new URL(`textures/trims/entity/${layer}/${pattern}_${material}_darker.png`,root)));
 }
});

test('passengers align their own attachment to the vehicle seat without cumulative gaps',()=>{
 const scene=buildPreviewScene(toSnapshot(['horse','zombie','skeleton']));let anchor=[0,0,0];const placements=[];
 for(const input of scene){const model=asset(`entities/${input.id}.json`);const placement=placePreviewEntity(input,model,anchor);if(input.riding)assert.ok(Math.abs(placement.position[1]+model.vehicle[1]*placement.scale-anchor[1])<1e-8);placements.push(placement);anchor=placement.next;}
 assert.ok(placements[1].position[1]>0.7 && placements[1].position[1]<0.8);
 assert.ok(placements[2].position[1]>2 && placements[2].position[1]<2.1);
});

test('worn elytra use the folded vanilla rest pose',()=>{
 const refs=asset('entities/zombie.json').poses.standing0.equipment.chest.elytra;
 const vertices=refs.flatMap(ref=>asset(`meshes/${ref}.json`).vertices);
 assert.ok(vertices.some(v=>v.slice(5,8).filter(n=>Math.abs(n)>.1 && Math.abs(n)<.99).length>=2));
});

test('native camera-facing renderers stay classified separately from solid geometry',()=>{
 for(const id of ['fireball','firework_rocket','experience_orb'])assert.equal(asset(`entities/${id}.json`).billboard,true);
 for(const id of ['zombie','boat','lightning_bolt'])assert.equal(asset(`entities/${id}.json`).billboard,false);
});

test('default entity states preserve shulker color, goat horns and the TNT fuse scale',()=>{
 const meshes=(id,key='standing0')=>asset(`entities/${id}.json`).poses[key].body.map(ref=>asset(`meshes/${ref}.json`));
 assert.ok(meshes('shulker').some(m=>m.texture==='minecraft:textures/entity/shulker/shulker.png'));
 assert.ok(Math.max(...meshes('goat').flatMap(m=>m.vertices.map(v=>v[1])))>1.6);
 const ys=meshes('tnt').flatMap(m=>m.vertices.map(v=>v[1]));assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-1)<1e-5);
});

test('every prepared resource matches the committed manifest',()=>{
 const manifest=asset('manifest.json');assert.equal(manifest.minecraft,'26.1.2');
 for(const [path,sha] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),sha,path);
});

test('prepared meshes, including tridents and banner poles, contain visible vertex alpha',()=>{
 for(const path of Object.keys(asset('manifest.json').files).filter(p=>p.startsWith('meshes/'))){
  const mesh=asset(path);assert.ok(mesh.vertices.some(v=>v[11]>0),path);
 }
});
