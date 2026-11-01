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
test('delegation owner/scopes/expiry/revoke, routes, no write reads/validation, CAS conflicts and rejected documents',async()=>{
  const id=randomUUID(),p=core.createStoneRoomProject(id,'room');await storage.createStructureProject('alice',id,p);
  await fails(()=>delegation.issueStructureDelegation('bob',{projectId:id,name:'x',hours:24,scopes:['get_project']}),404);
  for(const extra of [{hours:169},{scopes:['admin']},{owner:'bob'},{scopes:[]}])await fails(()=>delegation.issueStructureDelegation('alice',{projectId:id,name:'x',hours:24,scopes:['get_project'],...extra}),400);
  const grant=await delegation.issueStructureDelegation('alice',{projectId:id,name:'test',hours:24,scopes:['get_project','update_instance','validate_structure']});
  assert.ok(!JSON.stringify([...grants.values()]).includes(grant.secret));assert.equal(grants.get(grant.id).secret_hash.length,64);
  const before=writes;
  assert.equal((await getRoute.GET(req(id,grant.secret),context(id))).status,200);
  assert.equal((await getRoute.GET(req(randomUUID(),grant.secret),context(randomUUID()))).status,404);
  const valid=await validateRoute.POST(req(id,grant.secret,{document:{...p,revision:1}}),context(id));assert.equal((await valid.json()).valid,true);
  const invalid=await validateRoute.POST(req(id,grant.secret,{document:{...p,user_id:'bob'}}),context(id));assert.equal((await invalid.json()).diagnostics[0].code,'INVALID_STRUCTURE');
  const unsupported=structuredClone(p);unsupported.instances[0].parameters.wall.id='minecraft:bedrock';assert.equal((await (await validateRoute.POST(req(id,grant.secret,{document:unsupported}),context(id))).json()).diagnostics[0].code,'UNSUPPORTED_MATERIAL');
  assert.equal(writes,before,'get and validate do not write documents or auth metadata');
  const races=await Promise.allSettled([ops.updateStructureInstance('alice',{projectId:id,instanceId:'room',expectedRevision:1,changes:{rotation:90}}),ops.updateStructureInstance('alice',{projectId:id,instanceId:'room',expectedRevision:1,changes:{rotation:180}})]);
  assert.equal(races.filter(x=>x.status==='fulfilled').length,1);assert.equal(races.find(x=>x.status==='rejected').reason.status,409);assert.equal(projects.get(id).revision,2);
  const frozen=structuredClone(projects.get(id)),n=writes;
  for(const [owner,args,status] of [['bob',{expectedRevision:2,changes:{rotation:0}},404],['alice',{expectedRevision:1,changes:{rotation:0}},409],['alice',{instanceId:'missing',expectedRevision:2,changes:{rotation:0}},404],['alice',{expectedRevision:2,changes:{rotation:45}},400],['alice',{expectedRevision:2,changes:{parameters:{...p.instances[0].parameters,width:129,length:129,height:128}}},400]])await fails(()=>ops.updateStructureInstance(owner,{projectId:id,instanceId:'room',...args}),status);
  assert.deepEqual(projects.get(id),frozen);assert.equal(writes,n);
  const updated=await updateRoute.POST(req(id,grant.secret,{instanceId:'room',expectedRevision:2,changes:{rotation:270}}),context(id));assert.equal(updated.status,200);assert.equal((await updated.json()).document.revision,3);
  const stale=await updateRoute.POST(req(id,grant.secret,{instanceId:'room',expectedRevision:2,changes:{rotation:0}}),context(id));assert.equal(stale.status,409);
  const readOnly=await delegation.issueStructureDelegation('alice',{projectId:id,name:'read',hours:1,scopes:['get_project']});
  assert.equal((await updateRoute.POST(req(id,readOnly.secret,{instanceId:'room',expectedRevision:3,changes:{rotation:0}}),context(id))).status,403);
  assert.equal((await validateRoute.POST(req(id,readOnly.secret,{document:p}),context(id))).status,403);
  await fails(()=>delegation.revokeStructureDelegation('bob',grant.id),404);
  assert.ok(!JSON.stringify(await delegation.listStructureDelegations('alice')).includes(grant.secret));assert.deepEqual(await delegation.listStructureDelegations('bob'),[]);
  grants.get(grant.id).expires_at='2000-01-01';assert.equal((await getRoute.GET(req(id,grant.secret),context(id))).status,401);
  grants.get(grant.id).expires_at='2100-01-01';await delegation.revokeStructureDelegation('alice',grant.id);assert.equal((await getRoute.GET(req(id,grant.secret),context(id))).status,401);
  const foreign=randomUUID();await storage.createStructureProject('bob',foreign,{...p,id:foreign});
  // Even a corrupted delegation owner cannot bypass the project service owner check.
  grants.get(readOnly.id).project_id=foreign;assert.equal((await getRoute.GET(req(foreign,readOnly.secret),context(foreign))).status,404);
});
test('session-only issuance, Origin protection, no token reflection, bearer cannot use browser CRUD',async()=>{
  const id=randomUUID(),p=core.createStoneRoomProject(id,'room');await storage.createStructureProject('alice',id,p);
  const body={projectId:id,name:'test',hours:1,scopes:['get_project']};
  const make=(headers={})=>new Request('https://example.test/api/structures/delegations',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await grantRoute.POST(make())).status,403);
  assert.equal((await grantRoute.POST(make({Origin:'https://evil.test'}))).status,403);
  assert.equal((await grantRoute.POST(make({Origin:'https://example.test',Authorization:'Bearer secret'}))).status,401);
  const issued=await grantRoute.POST(make({Origin:'https://example.test'}));assert.equal(issued.status,201);assert.match((await issued.json()).secret,/^ss1_/);
  const denied=await getRoute.GET(req(id,'ss1_'+ 'x'.repeat(43)),context(id));assert.equal(denied.status,401);assert.ok(!(await denied.text()).includes('x'.repeat(43)));
  require('../.test-build/server/auth.js').getAuthUser=async()=>null;
  assert.equal((await grantRoute.POST(make({Origin:'https://example.test'}))).status,401);
  // Existing full PUT still requires Auth.js, never accepts delegated authority.
  const put=new Request(`https://example.test/api/structures/${id}`,{method:'PUT',headers:{Authorization:'Bearer secret','Content-Type':'application/json'},body:JSON.stringify({document:p,expectedRevision:1})});
  assert.equal((await getRoute.PUT(put,context(id))).status,401);
});
test('overlap, unknown references, material/properties and aggregate budget are rejected without document writes',async()=>{
  const id=randomUUID(),p=core.createStoneRoomProject(id,'first');
  p.instances.push({...structuredClone(p.instances[0]),id:'second',position:{x:30,y:0,z:0}});
  await storage.createStructureProject('alice',id,p);const before=structuredClone(projects.get(id)),n=writes;
  await fails(()=>ops.updateStructureInstance('alice',{projectId:id,instanceId:'second',expectedRevision:1,changes:{position:{x:0,y:0,z:0}}}),400);
  for(const args of [{changes:{definitionId:'missing'}},{changes:{parameters:{...p.instances[0].parameters,wall:{id:'minecraft:stone',properties:{axis:'x'}}}}},{changes:{parameters:{...p.instances[0].parameters,wall:{id:'minecraft:bedrock',properties:{}}}}},{expectedRevision:'1',changes:{rotation:0}},{changes:{parameters:{...p.instances[0].parameters,width:128}}}])await fails(()=>ops.updateStructureInstance('alice',{projectId:id,instanceId:'first',expectedRevision:1,...args}),400);
  const common=require('../.test-build/structure-core/operations.js');
  const overlap=structuredClone(p);overlap.instances[1].position={x:0,y:0,z:0};assert.equal(common.validateStructure(overlap,id).diagnostics[0].code,'OVERLAP');
  const lost=structuredClone(p);lost.instances[0].definitionId='missing';assert.equal(common.validateStructure(lost,id).valid,false);
  assert.deepEqual(projects.get(id),before);assert.equal(writes,n);
});
