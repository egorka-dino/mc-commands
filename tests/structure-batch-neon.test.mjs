import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const storage=require('../.test-build/server/structure-projects.js');
const ops=require('../.test-build/server/structure-operations.js');
const core=require('../.test-build/structure-core/index.js');
const db=require('../.test-build/server/db.js');
test('real Neon batch: persisted atomic swap, rejected last edit, budget, races, stale replay and cleanup',{skip:!process.env.DATABASE_URL},async()=>{
  const owner='structure-batch-test:'+randomUUID(),other='structure-batch-test:'+randomUUID(),ids=[];
  const original=db.getSql;let updates=0,reads=0;
  db.getSql=()=>{const sql=original();return async(strings,...values)=>{const q=strings.join('?');if(q.startsWith('update structure_projects'))updates++;if(q.startsWith('select * from structure_projects'))reads++;return sql(strings,...values);};};
  const move=(instanceId,x)=>({instanceId,changes:{position:{x,y:0,z:0}}});
  async function setup(){const id=randomUUID();ids.push(id);const p=core.createStoneRoomProject(id,'first');p.instances.push({...structuredClone(p.instances[0]),id:'second',position:{x:30,y:0,z:0}});await storage.createStructureProject(owner,id,p);return id;}
  const batch=(id,changes,expectedRevision=1)=>({projectId:id,expectedRevision,updates:changes});
  try {
    const id=await setup(),args=batch(id,[move('first',30),move('second',0)]),input=structuredClone(args),n=updates,r=reads;
    const result=await ops.batchUpdateStructureInstances(owner,args);
    assert.equal(updates,n+1);assert.equal(reads,r+1);assert.equal(result.document.revision,2);assert.deepEqual(args,input);
    assert.deepEqual((await storage.getStructureProject(owner,id)).document,result.document);assert.deepEqual(result.document.instances.map(i=>i.position.x),[30,0]);
    const frozen=await storage.getStructureProject(owner,id),before=updates;
    const large={...frozen.document.instances[0].parameters,width:51,length:51,height:50};
    for(const [changes,status] of [[[move('first',100),{instanceId:'second',changes:{rotation:45}}],400],[[move('first',100),move('unknown',120)],404],[[move('first',0),move('second',0)],400],[[{instanceId:'first',changes:{parameters:large}},{instanceId:'second',changes:{parameters:large,position:{x:100,y:0,z:0}}}],400]]) {
      await assert.rejects(()=>ops.batchUpdateStructureInstances(owner,batch(id,changes,2)),e=>e.status===status);
      assert.deepEqual(await storage.getStructureProject(owner,id),frozen);
    }
    await assert.rejects(()=>ops.batchUpdateStructureInstances(other,batch(id,[move('first',100)],2)),e=>e.status===404);
    await assert.rejects(()=>ops.batchUpdateStructureInstances(owner,args),e=>e.status===409);assert.equal(updates,before);
    const noOp=await ops.batchUpdateStructureInstances(owner,batch(id,args.updates,2));assert.equal(noOp.document.revision,3);
    for(const kind of ['batch','single','put']) {
      const raceId=await setup(),document=(await storage.getStructureProject(owner,raceId)).document;
      const first=ops.batchUpdateStructureInstances(owner,batch(raceId,[move('first',60),move('second',90)]));
      const second=kind==='batch'?ops.batchUpdateStructureInstances(owner,batch(raceId,[move('first',-60),move('second',-90)])):kind==='single'?ops.updateStructureInstance(owner,{projectId:raceId,instanceId:'first',expectedRevision:1,changes:{rotation:90}}):storage.updateStructureProject(owner,raceId,1,{...document,name:'test PUT storage service'});
      const results=await Promise.allSettled([first,second]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
      const saved=await storage.getStructureProject(owner,raceId),winner=results.find(r=>r.status==='fulfilled').value;
      assert.deepEqual(saved.document,winner.document);assert.equal(saved.document.revision,2);
      const rows=await original()`select revision,document from structure_projects where id=${raceId} and user_id=${owner}`;
      assert.equal(rows[0].revision,2);assert.deepEqual(rows[0].document,saved.document);
    }
  } finally {
    db.getSql=original;
    for(const id of ids)try{const saved=await storage.getStructureProject(owner,id);await storage.deleteStructureProject(owner,id,saved.document.revision);}catch(e){if(e.status!==404)throw e;}
    assert.deepEqual(await storage.listStructureProjects(owner),[]);
  }
});
