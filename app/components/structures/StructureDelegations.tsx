"use client";
import { useState } from "react";

type Grant={id:string;projectId:string;name:string;scopes:string[];expiresAt:string;revokedAt:string|null};
const scopes=["get_project","update_instance","validate_structure"];
const labels:Record<string,string>={get_project:"Читать проект",update_instance:"Менять комнаты",validate_structure:"Проверять структуру"};
export function StructureDelegations({projectId,enabled,signedIn}:{projectId:string;enabled:boolean;signedIn:boolean}) {
  const [grants,setGrants]=useState<Grant[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
  const [name,setName]=useState("Локальный MCP"),[hours,setHours]=useState(24),[selected,setSelected]=useState(["get_project","validate_structure"]);
  const [secret,setSecret]=useState(""),[error,setError]=useState("");
  async function api(method="GET",body?:unknown) {
    const response=await fetch("/api/structures/delegations",{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(20000)});
    const result=await response.json(); if (!response.ok) throw Error(result.error || "Не удалось выполнить запрос."); return result;
  }
  async function run(action:()=>Promise<void>) { setBusy(true);setError("");try{await action();}catch(e){setError(e instanceof Error?e.message:"Ошибка запроса.");}finally{setBusy(false);} }
  async function load() { const body=await api();setGrants(body.delegations);setLoaded(true); }
  return <details className="editor-section structure-delegations"><summary>Доступ локального MCP</summary>
    <p>Доступ действует только для одного сохранённого проекта. Локальный MCP читает серверную версию; изменения появятся здесь после ручной загрузки. Несохранённый черновик не заменяется автоматически.</p>
    <p><a href="/structures/mcp">Настройка локального процесса и хранение секрета</a></p>
    {!enabled && <p>Войдите через Google и сохраните проект, чтобы выдать доступ.</p>}
    <fieldset disabled={busy || !enabled}><legend>Новое делегирование для открытого проекта</legend>
      <label>Имя доступа<input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
      <label>Срок в часах (1–168)<input type="number" min={1} max={168} value={hours} onChange={e=>setHours(e.target.valueAsNumber)}/></label>
      {scopes.map(scope=><label key={scope}><input type="checkbox" checked={selected.includes(scope)} onChange={e=>setSelected(current=>e.target.checked?[...current,scope]:current.filter(item=>item!==scope))}/>{labels[scope]}</label>)}
      <button type="button" disabled={!selected.length || !name.trim() || !Number.isInteger(hours) || hours<1 || hours>168} onClick={()=>void run(async()=>{setSecret("");const result=await api("POST",{projectId,name,scopes:selected,hours});setSecret(result.secret);await load();})}>Выдать выбранный доступ</button>
    </fieldset>
    {secret && <div role="status"><p>Секрет показан один раз. Сохраните его в защищённый файл вне репозитория. Не отправляйте в чат. При потере выпустите новый и отзовите этот.</p><label>Секрет доступа<input type="password" readOnly value={secret} autoComplete="off" spellCheck={false}/></label><button type="button" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(secret);})}>Копировать секрет</button><button type="button" onClick={()=>setSecret("")}>Очистить секрет с экрана</button></div>}
    <button type="button" disabled={busy || !signedIn} onClick={()=>void run(load)}>Обновить мои доступы</button>
    {loaded && !grants.length && <p>Выданных доступов нет.</p>}
    {grants.map(grant=><div key={grant.id}><p>{grant.name} · проект {grant.projectId} · {grant.scopes.map(scope=>labels[scope]||scope).join(", ")} · до {new Date(grant.expiresAt).toLocaleString("ru-RU")} {grant.revokedAt?"· отозван":""}</p><button type="button" disabled={busy || !!grant.revokedAt} onClick={()=>void run(async()=>{await api("DELETE",{id:grant.id});setSecret("");await load();})}>Отозвать {grant.name}</button></div>)}
    {busy && <p role="status">Выполняем запрос…</p>}{error && <p role="alert">{error}</p>}
  </details>;
}
