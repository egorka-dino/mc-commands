import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,chmod,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const core=require('./.build/structure-core/index.js');
const id='ab54493d-a9d1-4127-a732-6f2e14240d40';
const secret=`ss1_${'x'.repeat(43)}`;
test('actual SDK stdio initialize/list/call, strict arguments, HTTP mapping, no retry or secret output',async()=>{
  const dir=await mkdtemp(join(await realpath(tmpdir()),'structure-mcp-'));
  await chmod(dir,0o700);const file=join(dir,'token');await writeFile(file,secret,{mode:0o600});
  const project=core.createStoneRoomProject(id,'room');project.revision=1;
  let calls=0,status=200,mode='normal';
  const http=createServer(async(req,res)=>{
    calls++;assert.equal(req.headers.authorization,`Bearer ${secret}`);
    let body='';for await(const chunk of req)body+=chunk;
    res.setHeader('Content-Type','application/json');
    if(mode==='drop'){req.socket.destroy();return;}
    if(mode==='redirect'){res.writeHead(302,{Location:'/leak'});res.end();return;}
    res.statusCode=status;
    if(status!==200){res.end(JSON.stringify({error:secret}));return;}
    if(req.url.endsWith('/validate')){res.end(JSON.stringify({valid:true,diagnostics:[],cellCount:968,conflictCount:0}));return;}
    if(req.url.endsWith('/instance')){const args=JSON.parse(body);assert.equal(args.expectedRevision,1);project.revision++;project.instances[0].position=args.changes.position;}
    res.end(JSON.stringify({document:project,updatedAt:'2026-11-01T00:00:00Z'}));
  });
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const transport=new StdioClientTransport({command:process.execPath,args:[new URL('server.mjs',import.meta.url).pathname],env:{STRUCTURE_API_URL:`http://127.0.0.1:${http.address().port}`,STRUCTURE_ALLOW_LOOPBACK_HTTP:'1',STRUCTURE_TOKEN_FILE:file},stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',chunk=>stderr+=chunk);
  const client=new Client({name:'acceptance',version:'1.0.0'});
  try {
    await client.connect(transport); // real initialize handshake
    const list=await client.listTools();assert.deepEqual(list.tools.map(t=>t.name),['get_project','update_instance','validate_structure']);
    for(const tool of list.tools)assert.equal(tool.inputSchema.additionalProperties,false);
    const call=(name,args)=>client.callTool({name,arguments:args});
    const get=await call('get_project',{projectId:id});assert.equal(get.structuredContent.document.revision,1);
    const before=calls;
    for(const args of [{projectId:id,token:secret},{projectId:'bad'}])assert.equal((await call('get_project',args)).isError,true);
    for(const changes of [{}, {revision:5},{rotation:45},{position:{x:0,y:0,z:0,sql:'bad'}}])assert.equal((await call('update_instance',{projectId:id,instanceId:'room',expectedRevision:1,changes})).isError,true);
    assert.equal(calls,before,'invalid calls never reach HTTP');
    const validation=await call('validate_structure',{projectId:id,document:project});assert.equal(validation.structuredContent.valid,true);
    const updated=await call('update_instance',{projectId:id,instanceId:'room',expectedRevision:1,changes:{position:{x:20,y:0,z:0}}});assert.equal(updated.structuredContent.document.revision,2);
    for(const code of [400,401,403,404,409,413,415,503]){
      status=code;const output=await call('get_project',{projectId:id});assert.equal(output.isError,true);assert.equal(output.structuredContent.error.status,code);assert.ok(!JSON.stringify(output).includes(secret));
    }
    status=200;
    for(mode of ['drop','redirect']){const n=calls;const output=await call('update_instance',{projectId:id,instanceId:'room',expectedRevision:2,changes:{rotation:90}});assert.equal(output.structuredContent.error.code,'NETWORK_ERROR');assert.equal(calls,n+1,'no redirect or ambiguous write retry');}
    assert.ok(!stderr.includes(secret));
  } finally {await client.close();await new Promise(resolve=>http.close(resolve));await rm(dir,{recursive:true,force:true});}
});

import {spawn} from 'node:child_process';
import {symlink} from 'node:fs/promises';
async function rawRun(env,input='') {
  const child=spawn(process.execPath,[new URL('server.mjs',import.meta.url).pathname],{env:{PATH:process.env.PATH,...env},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.stdin.end(input);const code=await new Promise(resolve=>child.on('close',resolve));return {code,stdout,stderr};
}
test('startup rejects insecure files and origins without secret disclosure; stdout contains only MCP frames',async()=>{
  const dir=await mkdtemp(join(await realpath(tmpdir()),'structure-stdio-'));await chmod(dir,0o700);
  const file=join(dir,'token');await writeFile(file,secret,{mode:0o600});
  const env={STRUCTURE_API_URL:'https://example.test',STRUCTURE_TOKEN_FILE:file};
  try{
    for(const url of ['http://example.test',`https://example.test/?token=${secret}`,`https://${secret}@example.test`]){const result=await rawRun({...env,STRUCTURE_API_URL:url});assert.equal(result.code,1);assert.equal(result.stdout,'');assert.ok(!result.stderr.includes(secret));}
    await chmod(file,0o644);assert.equal((await rawRun(env)).code,1);await chmod(file,0o600);
    const link=join(dir,'link');await symlink(file,link);assert.equal((await rawRun({...env,STRUCTURE_TOKEN_FILE:link})).code,1);
    const frames=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'raw',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'}];
    const result=await rawRun(env,frames.map(frame=>JSON.stringify(frame)).join('\n')+'\n');
    assert.equal(result.code,0);assert.ok(!result.stdout.includes(secret));assert.ok(!result.stderr.includes(secret));
    const responses=result.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.ok(responses.some(item=>item.id===1));assert.ok(responses.some(item=>item.id===2));for(const response of responses)assert.equal(response.jsonrpc,'2.0');
  }finally{await rm(dir,{recursive:true,force:true});}
});
