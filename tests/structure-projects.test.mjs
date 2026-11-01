import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const rows = new Map();
let writes = 0;
let databaseFailure = false;
// Execute the service against a deterministic SQL boundary. Real Neon race checks
// live in structure-projects-neon.test.mjs; this suite needs no credentials.
require('../.test-build/server/db.js').getSql = () => async (strings, ...values) => {
  if (databaseFailure) throw Error('internal connection secret must not appear in responses');
  const query = strings.join('?').replace(/\s+/g, ' ').trim();
  if (query.startsWith('create ')) return [];
  if (query.startsWith('insert ')) {
    const [id,user,format,json] = values;
    if (rows.has(id)) return [];
    const row={id,user_id:user,revision:1,format_version:format,document:JSON.parse(json),updated_at:'now'};
    rows.set(id,row); writes++; return [structuredClone(row)];
  }
  if (query.startsWith('update ')) {
    assert.match(query,/revision = revision \+ 1/);
    assert.match(query,/where id = \? and user_id = \? and revision = \?/);
    const [format,json,id,user,revision] = values, row=rows.get(id);
    if (!row || row.user_id!==user || row.revision!==revision) return [];
    Object.assign(row,{revision:row.revision+1,format_version:format,document:JSON.parse(json)});
    writes++; return [structuredClone(row)];
  }
  if (query.startsWith('delete ')) {
    const [id,user,revision] = values, row=rows.get(id);
    if (!row || row.user_id!==user || row.revision!==revision) return [];
    rows.delete(id); writes++; return [{id}];
  }
  if (query.includes("document->>'name' as name")) return [...rows.values()].filter(r=>r.user_id===values[0]).map(r=>({...r,name:r.document.name}));
  if (query.startsWith('select *')) {
    const row=rows.get(values[0]); return row?.user_id===values[1] ? [structuredClone(row)] : [];
  }
  throw Error(query);
};
const service=require('../.test-build/server/structure-projects.js');
const core=require('../.test-build/structure-core/index.js');
const fails=(fn,status)=>assert.rejects(fn,e=>e.status===status);
test('owner isolation, authoritative metadata, restored geometry, atomic race and rejection without writes',async()=>{
  const id=randomUUID(), project=core.createStoneRoomProject('untrusted','room');
  project.revision=99;
  project.instances[0].parameters.wall.id='minecraft:quartz_block';
  project.instances[0].parameters.doors.west=true;
  project.instances[0].position={x:-20,y:7,z:80}; project.instances[0].rotation=270;
  const first=await service.createStructureProject('alice',id,project);
  assert.equal(first.document.revision,1); assert.equal(first.document.id,id);
  assert.equal(project.revision,99,'caller input unchanged');
  assert.deepEqual(core.generateProject(first.document),core.generateProject({...project,id,revision:1}));
  assert.deepEqual(await service.createStructureProject('alice',id,project),first,'lost-create response retry');
  assert.equal((await service.listStructureProjects('bob')).length,0);
  await fails(()=>service.getStructureProject('bob',id),404);
  await fails(()=>service.updateStructureProject('bob',id,1,project),404);
  await fails(()=>service.deleteStructureProject('bob',id,1),404);
  await fails(()=>service.createStructureProject('bob',id,project),404);
  const contenders=await Promise.allSettled([
    service.updateStructureProject('alice',id,1,{...project,name:'A'}),
    service.updateStructureProject('alice',id,1,{...project,name:'B'}),
  ]);
  assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(contenders.find(r=>r.status==='rejected').reason.status,409);
  const current=await service.getStructureProject('alice',id);
  assert.equal(current.document.revision,2); assert.equal(rows.get(id).revision,2);
  const before=writes;
  await fails(()=>service.updateStructureProject('alice',id,2,{...project,user_id:'bob'}),400);
  await fails(()=>service.updateStructureProject('alice',id,2,{...project,formatVersion:2}),400);
  const overlap=structuredClone(project); overlap.instances.push({...overlap.instances[0],id:'second'});
  await fails(()=>service.updateStructureProject('alice',id,2,overlap),400);
  const budget=structuredClone(project); budget.instances[0].parameters.width=129; budget.instances[0].parameters.length=129; budget.instances[0].parameters.height=128;
  await fails(()=>service.updateStructureProject('alice',id,2,budget),400);
  await fails(()=>service.updateStructureProject('alice',id,-1,project),400);
  await fails(()=>service.updateStructureProject('alice',id,2,{...project,name:'a'.repeat(2_000_001)}),400);
  assert.equal(writes,before); assert.deepEqual(await service.getStructureProject('alice',id),current);
  await fails(()=>service.deleteStructureProject('alice',id,1),409);
  await service.deleteStructureProject('alice',id,2);
  await fails(()=>service.getStructureProject('alice',id),404);
});

test('HTTP: Auth.js identity, private responses, malformed/oversized input, cross-origin writes and 409/404',async()=>{
  let identity=null;
  const authPath=require.resolve('../.test-build/server/auth.js');
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{getAuthUser:async()=>identity}};
  const collection=require('../.test-build/api/structures/route.js');
  const item=require('../.test-build/api/structures/[id]/route.js');
  const id=randomUUID(), document=core.createStoneRoomProject('ignored','room');
  const context={params:Promise.resolve({id})};
  const request=(method,body,headers={})=>new Request('https://example.test/api/structures',{method,headers:{'Content-Type':'application/json',...headers},...(method!=='GET'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  assert.equal((await collection.GET(request('GET'))).status,401);
  assert.equal((await collection.POST(request('POST',{id,document}))).status,401);
  assert.equal((await item.GET(request('GET'),context)).status,401);
  assert.equal((await item.PUT(request('PUT',{document,expectedRevision:1}),context)).status,401);
  assert.equal((await item.DELETE(request('DELETE',{expectedRevision:1}),context)).status,401);
  identity={id:'http-alice'};
  assert.equal((await collection.POST(request('POST','{'))).status,400);
  assert.equal((await collection.POST(request('POST',' '.repeat(2_000_001)))).status,413);
  assert.equal((await collection.POST(request('POST',{id,document},{Origin:'https://evil.test'}))).status,403);
  assert.equal((await collection.POST(request('POST',{id,document},{'Content-Type':'text/plain'}))).status,415);
  assert.equal((await collection.POST(request('POST',{id,document,user_id:'http-bob'}))).status,201);
  assert.equal((await item.PUT(request('PUT',{document}),context)).status,400);
  assert.equal((await item.PUT(request('PUT',{document,expectedRevision:'1'}),context)).status,400);
  const read=await item.GET(request('GET'),context);
  assert.equal(read.headers.get('cache-control'),'private, no-store');
  assert.equal((await read.json()).document.revision,1);
  assert.equal((await item.PUT(request('PUT',{document,expectedRevision:1}),context)).status,200);
  assert.equal((await item.PUT(request('PUT',{document,expectedRevision:1}),context)).status,409);
  identity={id:'http-bob'};
  for (const [fn,method,body] of [[item.GET,'GET'],[item.PUT,'PUT',{document,expectedRevision:2}],[item.DELETE,'DELETE',{expectedRevision:2}]]) assert.equal((await fn(request(method,body),context)).status,404);
  assert.deepEqual((await (await collection.GET(request('GET'))).json()).projects,[]);
  identity={id:'http-alice'};
  assert.equal((await item.DELETE(request('DELETE',{expectedRevision:2}),context)).status,200);
  databaseFailure=true;
  try {const unavailable=await collection.GET(request('GET'));assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('internal connection secret'));} finally {databaseFailure=false;}
});
