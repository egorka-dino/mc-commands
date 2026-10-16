import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const temp = mkdtempSync(join(tmpdir(), 'mc-catalog-'));
try {
 const source = readFileSync('app/components/minecraft/data.ts','utf8');
 writeFileSync(join(temp,'data.cjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
 const data = createRequire(import.meta.url)(join(temp,'data.cjs'));
 const catalog={entities:Object.keys(data.ALL_MOBS),babyEntities:[...data.BABY_MOBS],slots:data.SUMMON_EQUIPMENT_SLOTS.map(({key,items})=>({key,items:[...items]}))};
 writeFileSync('tools/entity-export/catalog.json',JSON.stringify(catalog,null,2)+'\n');
 console.log(catalog.entities.length,'entities,',new Set(catalog.slots.flatMap(s=>s.items)).size,'equipment items');
} finally {rmSync(temp,{recursive:true,force:true});}
