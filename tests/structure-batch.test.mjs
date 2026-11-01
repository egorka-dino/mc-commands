import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),projects=new Map(),grants=new Map();let writes=0;
require('../.test-build/server/db.js').getSql=()=>async(strings,...v)=>{
  const q=strings.join('?').replace(/\s+/g,' ').trim();
  if(q.startsWith('create '))return [];
  if(q.startsWith('insert into structure_delegations')){const [id,user_id,project_id,name,secret_hash,scopes,expires_at]=v;grants.set(id,{id,user_id,project_id,name,secret_hash,scopes:JSON.parse(scopes),expires_at,revoked_at:null});writes++;return [];}
  if(q.startsWith('select user_id, project_id'))return [...grants.values()].filter(r=>r.secret_hash===v[0] && !r.revoked_at && new Date(r.expires_at)>new Date());
  if(q.startsWith('select id, project_id'))return [...grants.values()].filter(r=>r.user_id===v[0]).map(({secret_hash,...r})=>r);
  if(q.startsWith('update structure_delegations')){const r=grants.get(v[0]);if(!r||r.user_id!==v[1])return [];r.revoked_at='now';writes++;return [{id:r.id}];}
  if(q.startsWith('insert into structure_projects')){const [id,user_id,format_version,document]=v;const r={id,user_id,revision:1,format_version,document:JSON.parse(document),updated_at:'now'};projects.set(id,r);writes++;return [structuredClone(r)];}
  if(q.startsWith('select * from structure_projects')){const r=projects.get(v[0]);return r?.user_id===v[1]?[structuredClone(r)]:[];}
  if(q.startsWith('update structure_projects')){assert.match(q,/where id = \? and user_id = \? and revision = \?/);const [format_version,json,id,owner,revision]=v,r=projects.get(id);if(!r||r.user_id!==owner||r.revision!==revision)return [];Object.assign(r,{format_version,document:JSON.parse(json),revision:revision+1});writes++;return [structuredClone(r)];}
  throw Error('Unexpected query');
};
const authPath=require.resolve('../.test-build/server/auth.js');
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{getAuthUser:async()=>({id:'alice'})}};
const core=require('../.test-build/structure-core/index.js'),ops=require('../.test-build/server/structure-operations.js'),storage=require('../.test-build/server/structure-projects.js'),delegation=require('../.test-build/server/structure-delegations.js');
const getRoute=require('../.test-build/api/structures/[id]/route.js'),updateRoute=require('../.test-build/api/structures/[id]/instance/route.js'),validateRoute=require('../.test-build/api/structures/[id]/validate/route.js'),grantRoute=require('../.test-build/api/structures/delegations/route.js');
const fails=(fn,status)=>assert.rejects(fn,e=>e.status===status);
const req=(id,secret,body)=>new Request(`https://example.test/api/structures/${id}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const context=id=>({params:Promise.resolve({id})});
const batchRoute=require('../.test-build/api/structures/[id]/instances/batch/route.js');
const common=require('../.test-build/structure-core/operations.js');
const batch=(id,updates,expectedRevision=1)=>({projectId:id,expectedRevision,updates});
const move=(instanceId,x)=>({instanceId,changes:{position:{x,y:0,z:0}}});
async function setup(count=2) {
  const id=randomUUID(),p=core.createStoneRoomProject(id,'room');
  for(let i=1;i<count;i++)p.instances.push({...structuredClone(p.instances[0]),id:'room'+i,position:{x:i*20,y:0,z:0}});
  await storage.createStructureProject('alice',id,p);return {id,p};
}
test('batch atomic final snapshot, position swap, one UPDATE, stable IDs, immutable args and no-op revision',async()=>{
  const {id,p}=await setup(),args=batch(id,[move('room',20),move('room1',0)]),input=structuredClone(args),before=writes;
  const result=await ops.batchUpdateStructureInstances('alice',args);
  assert.equal(writes,before+1);assert.equal(result.document.revision,2);
  assert.deepEqual(result.document.instances.map(i=>[i.id,i.definitionId]),p.instances.map(i=>[i.id,i.definitionId]));
  assert.deepEqual(args,input);assert.deepEqual((await storage.getStructureProject('alice',id)).document,result.document);
  assert.deepEqual(result.document.instances.map(i=>i.position.x),[20,0]);
  const saved=structuredClone(projects.get(id));
  await fails(()=>ops.batchUpdateStructureInstances('alice',args),409);assert.deepEqual(projects.get(id),saved);
  const noOp=await ops.batchUpdateStructureInstances('alice',batch(id,args.updates,2));assert.equal(noOp.document.revision,3);
});
test('strict batch schema/runtime boundaries 0/1/100/101, duplicates, extra keys and malformed fields',async()=>{
  const {id,p}=await setup(100),updates=p.instances.map(i=>({instanceId:i.id,changes:{rotation:0}}));
  assert.equal(common.toolSchemas.batch_update_instances.properties.updates.minItems,1);
  assert.equal(common.toolSchemas.batch_update_instances.properties.updates.maxItems,100);
  assert.equal(common.parseToolArguments('batch_update_instances',batch(id,[updates[0]])).updates.length,1);
  const result=await ops.batchUpdateStructureInstances('alice',batch(id,updates));assert.equal(result.document.instances.length,100);assert.equal(result.document.revision,2);
  const bad=[batch(id,[]),batch(id,[...updates,move('extra',0)]),batch(id,[updates[0],updates[0]]),{...batch(id,[updates[0]]),name:'bad'},batch(id,[{...updates[0],definitionId:'bad'}]),batch(id,[{instanceId:'',changes:{rotation:0}}]),batch(id,[{instanceId:'room',changes:{}}]),batch(id,[{instanceId:'room',changes:{rotation:45}}]),batch(id,[{instanceId:'room',changes:{position:{x:0,y:0,z:0,extra:1}}}]),batch(id,[{instanceId:'room',changes:{position:{x:30000001,y:0,z:0}}}]),batch(id,[{instanceId:'room',changes:{position:{x:0,y:0}}}]),batch(id,[{instanceId:'room',changes:{parameters:{...p.instances[0].parameters,width:128}}}]),batch(id,[{instanceId:'room',changes:{parameters:{...p.instances[0].parameters,wall:{id:'minecraft:bedrock',properties:{}}}}}]),batch(id,[{instanceId:'room',changes:{parameters:{...p.instances[0].parameters,wall:{id:'minecraft:stone',properties:{axis:'x'}}}}}])];
  for(const revision of [0,2147483647,1.5,'1',null])bad.push(batch(id,[updates[0]],revision));
  const snapshot=structuredClone(projects.get(id)),n=writes;
  for(const args of bad)await fails(()=>ops.batchUpdateStructureInstances('alice',args),400);
  assert.deepEqual(projects.get(id),snapshot);assert.equal(writes,n);
});
test('invalid last update, missing ID, final overlap and aggregate budget never persist partial edits',async()=>{
  const {id,p}=await setup(),snapshot=structuredClone(projects.get(id)),n=writes;
  const large={...p.instances[0].parameters,width:51,length:51,height:50}; // each valid, combined >250k
  const cases=[[[move('room',60),{instanceId:'room1',changes:{rotation:45}}],400],[[move('room',60),move('missing',100)],404],[[move('room',20),move('room1',20)],400],[[{instanceId:'room',changes:{parameters:large}},{instanceId:'room1',changes:{parameters:large,position:{x:100,y:0,z:0}}}],400],[[move('room',60),{instanceId:'room1',changes:{definitionId:'missing'}}],400]];
  for(const [updates,status] of cases){await fails(()=>ops.batchUpdateStructureInstances('alice',batch(id,updates)),status);assert.deepEqual(projects.get(id),snapshot);}
  await fails(()=>ops.batchUpdateStructureInstances('bob',batch(id,[move('room',60)])),404);
  assert.equal(writes,n);
});
test('concurrent batch/batch, batch/single and batch/PUT have exactly one persisted winner',async()=>{
  for(const kind of ['batch','single','put']){
    const {id}=await setup();
    const first=ops.batchUpdateStructureInstances('alice',batch(id,[move('room',60),move('room1',100)]));
    const other=kind==='batch'?ops.batchUpdateStructureInstances('alice',batch(id,[move('room',-60),move('room1',-100)])):kind==='single'?ops.updateStructureInstance('alice',{projectId:id,instanceId:'room',expectedRevision:1,changes:{rotation:90}}):getRoute.PUT(new Request(`https://example.test/api/structures/${id}`,{method:'PUT',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify({expectedRevision:1,document:{...(await storage.getStructureProject('alice',id)).document,name:'put'}})}),context(id)).then(async r=>{if(!r.ok)throw {status:r.status};return r.json();});
    const results=await Promise.allSettled([first,other]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
    const winner=results.find(r=>r.status==='fulfilled').value;
    assert.deepEqual((await storage.getStructureProject('alice',id)).document,winner.document);assert.equal(winner.document.revision,2);
  }
});
test('batch scope isolation, legacy grants, owner/session/Origin, expiry/revoke and safe HTTP errors',async()=>{
  const {id}=await setup(),body={expectedRevision:1,updates:[move('room',60)]};
  const grant=await delegation.issueStructureDelegation('alice',{projectId:id,name:'batch',hours:1,scopes:['batch_update_instances']});
  const legacy=await delegation.issueStructureDelegation('alice',{projectId:id,name:'legacy',hours:1,scopes:['get_project','update_instance','validate_structure']});
  const all=await delegation.issueStructureDelegation('alice',{projectId:id,name:'all',hours:1,scopes:common.STRUCTURE_TOOLS});assert.equal(all.scopes.length,4);
  assert.equal((await batchRoute.POST(req(id,legacy.secret,body),context(id))).status,403);
  for(const [route,data] of [[getRoute,null],[updateRoute,{instanceId:'room',expectedRevision:1,changes:{rotation:0}}],[validateRoute,{document:projects.get(id).document}]])assert.equal((await route[data?'POST':'GET'](req(id,grant.secret,data),context(id))).status,403);
  assert.equal((await batchRoute.POST(req(randomUUID(),grant.secret,body),context(randomUUID()))).status,404);
  const response=await batchRoute.POST(req(id,grant.secret,body),context(id));assert.equal(response.status,200);assert.equal((await response.json()).document.revision,2);
  const snapshot=structuredClone(projects.get(id));
  for(const [bad,status] of [[{...body,projectId:id},400],[{...body,updates:[move('room',60),move('room',90)]},400],[{...body,expectedRevision:2,updates:[move('room',60),move('missing',90)]},404],[body,409]]){const r=await batchRoute.POST(req(id,grant.secret,bad),context(id));assert.equal(r.status,status);assert.ok(!(await r.text()).includes(grant.secret));}
  const request=(headers,raw=JSON.stringify({...body,expectedRevision:2}))=>new Request(`https://example.test/api/structures/${id}/instances/batch`,{method:'POST',headers,body:raw});
  assert.equal((await batchRoute.POST(request({'Content-Type':'text/plain',Authorization:`Bearer ${grant.secret}`}),context(id))).status,415);
  assert.equal((await batchRoute.POST(request({'Content-Type':'application/json',Authorization:`Bearer ${grant.secret}`},' '.repeat(2_000_001)),context(id))).status,413);
  assert.equal((await batchRoute.POST(request({'Content-Type':'application/json',Origin:'https://evil.test',Authorization:`Bearer ${grant.secret}`}),context(id))).status,403);
  assert.equal((await batchRoute.POST(request({'Content-Type':'application/json'}),context(id))).status,403);
  grants.get(grant.id).expires_at='2000-01-01';assert.equal((await batchRoute.POST(req(id,grant.secret,body),context(id))).status,401);
  grants.get(grant.id).expires_at='2099-01-01';await delegation.revokeStructureDelegation('alice',grant.id);assert.equal((await batchRoute.POST(req(id,grant.secret,body),context(id))).status,401);
  assert.deepEqual(projects.get(id),snapshot);
  const session=await batchRoute.POST(request({'Content-Type':'application/json',Origin:'https://example.test'}),context(id));assert.equal(session.status,200);assert.equal(projects.get(id).revision,3);
  require('../.test-build/server/auth.js').getAuthUser=async()=>({id:'bob'});
  assert.equal((await batchRoute.POST(request({'Content-Type':'application/json',Origin:'https://example.test'}),context(id))).status,404);
  require('../.test-build/server/auth.js').getAuthUser=async()=>null;
  assert.equal((await batchRoute.POST(request({'Content-Type':'application/json',Origin:'https://example.test'}),context(id))).status,401);
});
