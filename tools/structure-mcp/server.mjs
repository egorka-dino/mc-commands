import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, dirname } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {toolSchemas,outputSchemas,parseToolArguments,STRUCTURE_TOOLS}=require('./.build/structure-core/operations.js');

const descriptions={get_project:'Прочитать серверную версию своего проекта.',update_instance:'Изменить параметры, позицию или поворот существующей комнаты с expectedRevision. При сетевой ошибке сначала перечитать проект.',validate_structure:'Проверить снимок структуры без сохранения.'};
const errorMessages={INVALID_ARGUMENT:'Некорректные аргументы.',UNAUTHORIZED:'Доступ истёк, отозван или не подтверждён.',FORBIDDEN:'Операция не разрешена.',NOT_FOUND:'Проект или экземпляр не найден.',CONFLICT:'Конфликт версий. Перечитайте проект.',TOO_LARGE:'Запрос слишком большой.',UNSUPPORTED_MEDIA_TYPE:'Ожидается JSON.',UNAVAILABLE:'Сервис недоступен.',NETWORK_ERROR:'Исход запроса неизвестен. Перечитайте проект перед следующей записью.'};
const statusCodes={400:'INVALID_ARGUMENT',401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'TOO_LARGE',415:'UNSUPPORTED_MEDIA_TYPE',503:'UNAVAILABLE'};
function failure(code,status=0) { const result={error:{code,message:errorMessages[code],status}}; return {isError:true,content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}; }
async function readSecret(path) {
  if (!path || !isAbsolute(path)) throw Error();
  // Parent is private too; reject a symlink at every path component.
  for (let part=path;;part=dirname(part)) {
    const stat=await lstat(part);
    if (stat.isSymbolicLink()) throw Error();
    if (part===dirname(part)) break;
  }
  const parent=await lstat(dirname(path));
  if ((parent.mode & 0o077)!==0 || parent.uid!==process.getuid?.()) throw Error();
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=await handle.stat();
    if (!stat.isFile() || stat.uid!==process.getuid?.() || (stat.mode & 0o777)!==0o600 || stat.size>128) throw Error();
    const secret=(await handle.readFile('utf8')).trim();
    if (!/^ss1_[A-Za-z0-9_-]{43}$/.test(secret)) throw Error();
    return secret;
  } finally {await handle.close();}
}
function apiOrigin(input) {
  const url=new URL(input);
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if ((url.protocol!=='https:' && !(url.protocol==='http:' && loopback && process.env.STRUCTURE_ALLOW_LOOPBACK_HTTP==='1')) || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw Error();
  return url.origin;
}
async function main() {
  const origin=apiOrigin(process.env.STRUCTURE_API_URL);
  const secret=await readSecret(process.env.STRUCTURE_TOKEN_FILE);
  const server=new Server({name:'structure-studio',version:'0.1.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:STRUCTURE_TOOLS.map(name=>({name,description:descriptions[name],inputSchema:toolSchemas[name],outputSchema:outputSchemas[name],annotations:{readOnlyHint:name!=='update_instance',destructiveHint:name==='update_instance',idempotentHint:name!=='update_instance',openWorldHint:false}}))}));
  server.setRequestHandler(CallToolRequestSchema,async request=>{
    const name=request.params.name;
    if (!STRUCTURE_TOOLS.includes(name)) throw new McpError(ErrorCode.InvalidParams,'Unknown tool');
    let args;
    try {args=parseToolArguments(name,request.params.arguments);} catch {return failure('INVALID_ARGUMENT',400);}
    const path=`/api/structures/${encodeURIComponent(args.projectId)}`;
    const body=name==='get_project'?undefined:name==='update_instance'?{instanceId:args.instanceId,expectedRevision:args.expectedRevision,changes:args.changes}:{document:args.document};
    try {
      // No retries, no redirects (including same-origin login redirects), no cookies.
      const response=await fetch(`${origin}${path}${name==='update_instance'?'/instance':name==='validate_structure'?'/validate':''}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
      if (!response.ok) return failure(statusCodes[response.status]||'UNAVAILABLE',response.status);
      // Bound responses independently of Content-Length and never relay an unexpected body.
      let raw='',size=0; const decoder=new TextDecoder();
      for await (const chunk of response.body) {size+=chunk.byteLength;if(size>2_000_000)throw Error();raw+=decoder.decode(chunk,{stream:true});}
      raw+=decoder.decode();
      const data=JSON.parse(raw);
      if (raw.includes(secret)) throw Error();
      if (name==='validate_structure') {
        if (typeof data.valid!=='boolean' || !Array.isArray(data.diagnostics) || data.diagnostics.length>20 || !Number.isInteger(data.cellCount) || !Number.isInteger(data.conflictCount)) throw Error();
      } else if (!data.document || data.document.id!==args.projectId || !Number.isInteger(data.document.revision) || typeof data.updatedAt!=='string') throw Error();
      return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
    } catch {return failure('NETWORK_ERROR');}
  });
  server.onerror=()=>{process.stderr.write('Structure MCP protocol error.\n');};
  await server.connect(new StdioServerTransport());
}
main().catch(()=>{process.stderr.write('Structure MCP startup failed. Check API origin and private token file.\n');process.exitCode=1;});
