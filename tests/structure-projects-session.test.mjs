import {readSchematic} from './helpers/schematic-reader.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {encode} from 'next-auth/jwt';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL) throw Error('DATABASE_URL required for the API → Neon integration test');
const core=require('../.test-build/structure-core/index.js');
const origin='http://localhost:3198',secret=randomBytes(32).toString('base64url');
const owner='structure-session-test-'+randomUUID(), stranger='structure-session-test-'+randomUUID();
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3198'],{stdio:'ignore',env:{...process.env,AUTH_SECRET:secret,AUTH_GOOGLE_ID:'test-client',AUTH_GOOGLE_SECRET:'test-secret',AUTH_TRUST_HOST:'true',AUTH_URL:origin}});
const cookieName='authjs.session-token';
const cookie=async googleId=>`${cookieName}=${await encode({token:{googleId,email:googleId+'@example.test',name:'Structure test'},secret,salt:cookieName})}`;
const ownerCookie=await cookie(owner),otherCookie=await cookie(stranger),id=randomUUID();
const document=core.createStoneRoomProject('untrusted','room');
document.instances[0].parameters.wall.id='minecraft:quartz_block';document.instances[0].rotation=270;document.instances[0].position={x:24,y:11,z:-60};
const request=(path,session=ownerCookie,method='GET',body)=>fetch(origin+'/api/structures'+path,{method,headers:{Cookie:session,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready);
  assert.equal((await request('','')).status,401);
  const created=await request('',ownerCookie,'POST',{id,document});assert.equal(created.status,201);
  const saved=await created.json();
  assert.equal(saved.document.revision,1);assert.equal(saved.document.id,id);
  const restored=await (await request('/'+id)).json();assert.deepEqual(restored,saved);
  assert.deepEqual(restored.document.instances,document.instances);
  assert.equal((await (await request('')).json()).projects[0].id,id);
  for(const [method,body]of [['GET'],['PUT',{document,expectedRevision:1}],['DELETE',{expectedRevision:1}]]) assert.equal((await request('/'+id,otherCookie,method,body)).status,404);
  assert.deepEqual((await(await request('',otherCookie)).json()).projects,[]);
  const responses=await Promise.all(['A','B'].map(name=>request('/'+id,ownerCookie,'PUT',{document:{...document,name},expectedRevision:1})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const latest=await(await request('/'+id)).json();assert.equal(latest.document.revision,2);
  const invalid=structuredClone(latest.document);invalid.instances.push({...invalid.instances[0],id:'overlap'});
  assert.equal((await request('/'+id,ownerCookie,'PUT',{document:invalid,expectedRevision:2})).status,400);
  assert.deepEqual(await(await request('/'+id)).json(),latest);
  assert.equal((await request('/'+id,ownerCookie,'DELETE',{expectedRevision:1})).status,409);
  assert.equal((await request('/'+id+'/export','')).status,401);
  assert.equal((await request('/'+id+'/export',otherCookie)).status,404);
  const exported=await request('/'+id+'/export');assert.equal(exported.status,200);
  const serverSchem=readSchematic(Buffer.from(await exported.arrayBuffer()));assert.equal(serverSchem.DataVersion,4325);
  const local=structuredClone(latest.document);local.instances[0].parameters.floor.id='minecraft:oak_planks';
  const snapshot=await request('/export','','POST',{document:local});assert.equal(snapshot.status,200);
  const localSchem=readSchematic(Buffer.from(await snapshot.arrayBuffer()));
  assert.equal(localSchem.at(24,11,-60),'minecraft:oak_planks');assert.equal(serverSchem.at(24,11,-60),'minecraft:stone_bricks');
  assert.deepEqual(await(await request('/'+id)).json(),latest,'export does not save dirty snapshot or increment revision');

  console.log('PASS: real Next.js → Auth.js test sessions → Neon, create/list/open/restore/update, foreign isolation, concurrent 200/409, no partial writes; saved/local .schem independently decoded, 401/404 isolation, no export writes');
}finally{
  try{const response=await request('/'+id);if(response.ok){const saved=await response.json();assert.equal((await request('/'+id,ownerCookie,'DELETE',{expectedRevision:saved.document.revision})).status,200);}}finally{
    if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
  }
}
