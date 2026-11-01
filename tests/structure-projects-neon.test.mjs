import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const service=require('../.test-build/server/structure-projects.js');
const core=require('../.test-build/structure-core/index.js');
test('real Neon: persisted round trip, ownership, concurrent CAS, rollback on validation failure', {skip:!process.env.DATABASE_URL},async()=>{
  const user='structure-test:'+randomUUID(), other='structure-test:'+randomUUID(), id=randomUUID();
  const project=core.createStoneRoomProject('ignored','room');
  project.instances[0].rotation=90; project.instances[0].position={x:25,y:-3,z:10};
  project.instances[0].parameters.floor.id='minecraft:oak_planks';
  // Core validates property syntax, not the Minecraft registry; exercise jsonb key ordering.
  project.instances[0].parameters.wall.properties={waterlogged:'false',facing:'north'};
  project.instances[0].parameters.doors.north=true;
  try {
    const created=await service.createStructureProject(user,id,project);
    assert.deepEqual(await service.getStructureProject(user,id),created);
    assert.deepEqual(await service.createStructureProject(user,id,project),created,'identical create survives jsonb key reordering');
    assert.equal((await service.listStructureProjects(user))[0].id,id);
    assert.deepEqual(await service.listStructureProjects(other),[]);
    for (const action of [()=>service.getStructureProject(other,id),()=>service.updateStructureProject(other,id,1,project),()=>service.deleteStructureProject(other,id,1)]) await assert.rejects(action,e=>e.status===404);
    const results=await Promise.allSettled(['A','B'].map(name=>service.updateStructureProject(user,id,1,{...project,name})));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
    const saved=await service.getStructureProject(user,id);
    assert.equal(saved.document.revision,2);
    assert.deepEqual(saved.document.instances,project.instances);
    const bad=structuredClone(saved.document); bad.instances.push({...bad.instances[0],id:'overlap'});
    await assert.rejects(()=>service.updateStructureProject(user,id,2,bad),e=>e.status===400);
    assert.deepEqual(await service.getStructureProject(user,id),saved);
    const {getSql}=require('../.test-build/server/db.js');
    const rows=await getSql()`select revision, document->>'revision' as document_revision from structure_projects where id=${id}`;
    assert.equal(rows[0].revision,Number(rows[0].document_revision));
    await assert.rejects(()=>getSql()`update structure_projects set revision=revision+1 where id=${id}`,
      error=>error.code==='23514', 'database CHECK rejects a row/document revision mismatch');
    assert.deepEqual(await service.getStructureProject(user,id),saved,'failed SQL statement leaves the document intact');
  } finally {
    try {const saved=await service.getStructureProject(user,id); await service.deleteStructureProject(user,id,saved.document.revision);} catch(e) {if(e.status!==404) throw e;}
  }
});
