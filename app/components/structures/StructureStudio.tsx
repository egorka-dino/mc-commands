"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { defaultStoneRoomParameters, generateProject, parseProject, ROOM_GENERATOR } from "../../structure-core";
import type { Direction, ModuleInstance, Rotation, StructureProject } from "../../structure-core";
import { EditorSection } from "../editor/EditorSection";
import { MATERIALS } from "./scene-geometry";

const StructurePreview = dynamic(() => import("./StructurePreview"), { ssr:false, loading:() => <p role="status">Загружаем 3D-просмотр…</p> });
const directions: [Direction,string][] = [["north","Север −Z"],["east","Восток +X"],["south","Юг +Z"],["west","Запад −X"]];
const emptyProject = (): StructureProject => ({ formatVersion:1, id:"local-scene", name:"Новая постройка", revision:0, definitions:[], instances:[] });

function NumberField({ label, value, min, max, step=1, onChange }: { label:string; value:number; min:number; max:number; step?:number; onChange:(n:number)=>void }) {
  // A draft permits clearing/typing a number without committing invalid geometry.
  const [draft,setDraft] = useState(String(value));
  const [previous,setPrevious] = useState(value);
  if (previous !== value) { setPrevious(value); setDraft(String(value)); }
  return <label>{label}<input type="number" value={draft} min={min} max={max} step={step}
    onChange={e => { setDraft(e.target.value); const n=e.target.valueAsNumber; if (Number.isInteger(n) && n>=min && n<=max && (n-min)%step===0) onChange(n); }}
    onBlur={() => setDraft(String(value))} /></label>;
}

export function StructureStudio() {
  const [project,setProject] = useState(emptyProject);
  const [nameDraft,setNameDraft] = useState("Новая постройка");
  const [baseline,setBaseline] = useState(() => JSON.stringify(emptyProject()));
  const [cloud,setCloud] = useState(false);
  const [user,setUser] = useState<boolean | null>(null);
  const [projects,setProjects] = useState<{id:string;name:string;revision:number}[]>([]);
  const [busy,setBusy] = useState(false);
  const [cloudError,setCloudError] = useState("");
  const [notice,setNotice] = useState("");
  const [conflict,setConflict] = useState(false);
  const [ready,setReady] = useState(false);
  const [confirmation,setConfirmation] = useState<{message:string;action:()=>void} | null>(null);
  const dirty = JSON.stringify(project) !== baseline;
  const [selected,setSelected] = useState<string | null>(null);
  const [error,setError] = useState("");
  async function api(path:string, options:RequestInit = {}) {
    const response = await fetch(`/api/structures${path}`, { ...options, headers:{"Content-Type":"application/json"}, cache:"no-store", signal:AbortSignal.timeout(20000) });
    const body = await response.json();
    if (!response.ok) {
      if (response.status===401) setUser(false);
      if (response.status===409) setConflict(true);
      throw Error(body.error || "Не удалось выполнить запрос.");
    }
    return body;
  }
  async function refresh() {
    const body=await api(""); setProjects(body.projects); setUser(true);
  }
  useEffect(() => {
    try {
      const raw=sessionStorage.getItem("structure-studio-draft");
      if (raw) {
        const draft=JSON.parse(raw), restored=parseProject(draft.project);
        setProject(restored); setNameDraft(restored.name); setBaseline(typeof draft.baseline==="string" ? draft.baseline : "");
        setCloud(draft.cloud===true); setSelected(restored.instances[0]?.id ?? null);
        setNotice("Восстановлена сцена этой вкладки. Список облачных проектов можно открыть ниже.");
      }
    } catch { /* An invalid local draft must not prevent using the editor. */ }
    setReady(true);
    let active=true;
    fetch("/api/auth/status", {cache:"no-store",signal:AbortSignal.timeout(20000)}).then(r => {if (!r.ok) throw Error(); return r.json();}).then(async status => {
      if (!active) return;
      setUser(status.authenticated);
      if (status.authenticated) await refresh();
    }).catch(() => {if (active) setCloudError("Не удалось загрузить аккаунт или список проектов. Повторите запрос.");});
    return () => {active=false;};
  }, []); // Initial account lookup; no polling or background synchronization.
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem("structure-studio-draft", JSON.stringify({project,baseline,cloud})); }
    catch { setNotice("Черновик вкладки недоступен. Сохраните проект в облаке перед выходом."); }
  }, [project,baseline,cloud,ready]);
  useEffect(() => {
    const warn=(event:BeforeUnloadEvent) => { if (dirty) {event.preventDefault(); event.returnValue="";} };
    window.addEventListener("beforeunload",warn);
    return () => window.removeEventListener("beforeunload",warn);
  }, [dirty]);
  async function run(action:()=>Promise<void>) {
    if (busy) return;
    setBusy(true); setCloudError(""); setNotice("");
    try { await action(); }
    catch (e) {setCloudError(e instanceof Error && e.name==="Error" ? e.message : "Нет ответа от сервера. Повторите запрос; локальная сцена сохранена.");}
    finally {setBusy(false);}
  }
  function accept(document:StructureProject) {
    const valid=parseProject(document);
    setProject(valid); setNameDraft(valid.name); setBaseline(JSON.stringify(valid)); setCloud(true);
    setSelected(valid.instances[0]?.id ?? null); setConflict(false); setError("");
  }
  function openProject(id:string, force=false) {
    const action=() => {void run(async () => {const saved=await api(`/${id}`); accept(saved.document); setNotice("Проект открыт.");});};
    if (force || dirty) setConfirmation({message:"Загрузить серверную версию? Несохранённые локальные правки этой сцены будут потеряны.",action});
    else action();
  }
  function newProject() {
    const action=() => {
      const next={...emptyProject(),id:crypto.randomUUID()};
      setProject(next); setNameDraft(next.name); setBaseline(""); setCloud(false); setSelected(null); setConflict(false); setCloudError(""); setNotice("");
    };
    if (dirty) setConfirmation({message:"Создать новый проект? Несохранённые правки текущей сцены будут потеряны.",action});
    else action();
  }
  function saveProject() {
    void run(async () => {
      const id=project.id==="local-scene" ? crypto.randomUUID() : project.id;
      const snapshot={...project,id};
      // Keep the same create ID on retry, even if the first response was lost.
      setProject(snapshot);
      const saved=await api(cloud ? `/${id}` : "", {method:cloud ? "PUT" : "POST",body:JSON.stringify({id,document:snapshot,expectedRevision:project.revision})});
      accept(saved.document); setNotice(`Сохранено. Версия ${saved.document.revision}.`);
      try {await refresh();} catch {setCloudError("Проект сохранён, но список не обновился. Повторите загрузку списка.");}
    });
  }
  function removeProject() {
    setConfirmation({message:"Удалить этот проект из облака? Текущая сцена останется локальной копией.",action:() => {void run(async () => {
      await api(`/${project.id}`, {method:"DELETE",body:JSON.stringify({expectedRevision:project.revision})});
      setCloud(false); setProject({...project,id:crypto.randomUUID(),revision:0}); setBaseline(""); setConflict(false); setNotice("Проект удалён. Сцену можно сохранить как новый проект.");
      try {await refresh();} catch {setCloudError("Проект удалён, но список не обновился. Повторите загрузку списка.");}
    });}});
  }
  const result = useMemo(() => generateProject(project),[project]);
  const instance = project.instances.find(i => i.id===selected);
  const commit = (next:StructureProject) => {
    try { const valid=parseProject(next); setProject(valid); setError(""); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось изменить сцену"); return false; }
  };
  const update = (patch:Partial<ModuleInstance>) => {
    if (instance) commit({ ...project, instances:project.instances.map(i => i.id===instance.id ? {...i,...patch} : i) });
  };
  const addRoom = () => {
    const id=crypto.randomUUID(), parameters=defaultStoneRoomParameters();
    // Place the new volume east of existing world-space bounds, including rotations.
    const x=result.cells.length ? result.cells.reduce((max,c) => Math.max(max,c.position.x),-Infinity)+3 : 0;
    const next={ ...project, definitions:project.definitions.length ? project.definitions : [{ id:ROOM_GENERATOR, generator:ROOM_GENERATOR, parameters:defaultStoneRoomParameters() }], instances:[...project.instances,{ id, definitionId:ROOM_GENERATOR, parameters, position:{x,y:0,z:0}, rotation:0 as const }] };
    if (commit(next)) setSelected(id);
  };
  return <>
    <section className="panel structure-projects" aria-label="Проекты" aria-busy={busy}>
      <label>Название проекта<input value={nameDraft} maxLength={200} disabled={busy || !!confirmation} onChange={e => {setNameDraft(e.target.value); if (e.target.value.trim()) setProject({...project,name:e.target.value});}} onBlur={() => setNameDraft(project.name)} /></label>
      <div className="structure-project-actions">
        <button className="btn" disabled={busy || !!confirmation} onClick={newProject}>Новый проект</button>
        <button className="btn" disabled={busy || !!confirmation || user!==true || !nameDraft.trim() || !!result.conflicts.length || conflict} onClick={saveProject}>Сохранить в облаке</button>
        {cloud && <button className="btn" disabled={busy || !!confirmation || user!==true} onClick={removeProject}>Удалить проект</button>}
        <button className="btn" disabled={busy || !!confirmation} onClick={() => void run(refresh)}>Обновить список проектов</button>
      </div>
      <p role="status">{busy ? "Выполняем запрос…" : dirty ? "Есть несохранённые изменения." : cloud ? `Облачный проект · версия ${project.revision}` : "Локальная сцена."}</p>
      {user===null && <p role="status">Проверяем аккаунт…</p>}
      {user!==true && <p>Локальный редактор доступен без входа. Для сохранения и открытия своих проектов в облаке <a href="/sign-in?redirect_url=%2Fstructures" onClick={e => {if (busy) e.preventDefault();}}>войдите через Google</a>. Черновик останется в этой вкладке после возвращения.</p>}
      {user===true && <label>Мои проекты<select disabled={busy || !!confirmation} value="" onChange={e => {if (e.target.value) openProject(e.target.value);}}>
        <option value="">Выберите проект для открытия</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name} · версия {p.revision}</option>)}
      </select></label>}
      {cloud && <button className="btn" disabled={busy || !!confirmation || user!==true} onClick={() => openProject(project.id, true)}>Загрузить серверную версию</button>}
      {confirmation && <div role="alertdialog" aria-label="Подтверждение действия" className="structure-confirmation">
        <p>{confirmation.message}</p>
        <div className="structure-project-actions">
          <button className="btn" autoFocus onClick={() => setConfirmation(null)}>Отмена</button>
          <button className="btn" onClick={() => {const action=confirmation.action; setConfirmation(null); action();}}>Подтвердить</button>
        </div>
      </div>}
      {notice && <p role="status">{notice}</p>}
      {cloudError && <p role="alert" className="structure-error">{cloudError} Сцену можно продолжать редактировать. Повторите действие соответствующей кнопкой.</p>}
      {conflict && <div role="alert" className="structure-error"><p>Конфликт версий. Локальная сцена не заменена. Сначала загрузите серверную версию с подтверждением потери правок или сохраните локальную сцену как отдельный проект.</p>
        <button className="btn" disabled={busy || !!confirmation} onClick={() => openProject(project.id,true)}>Загрузить серверную версию с подтверждением</button>
        <button className="btn" disabled={busy || !!confirmation} onClick={() => {setCloud(false); setProject({...project,id:crypto.randomUUID(),revision:0}); setBaseline(""); setConflict(false); setCloudError("");}}>Оставить правки в новом проекте</button>
      </div>}
    </section>
    <div className="structure-studio">
      <aside className="panel structure-settings" aria-label="Настройки постройки"><fieldset className="structure-editor-fields" disabled={busy || !!confirmation}>
        <div className="structure-panel-heading"><h2>Сцена</h2><span>{project.instances.length} / 100</span></div>
        <button type="button" className="btn" onClick={addRoom}>+ Добавить Stone Room</button>
        {project.instances.length ? <label>Комната<select value={selected ?? ""} onChange={e => setSelected(e.target.value)}>{project.instances.map((i,n) => <option key={i.id} value={i.id}>Stone Room {n+1}</option>)}</select></label> : <p>Пока здесь пусто. Добавь первую комнату.</p>}
        {instance && <div key={instance.id}>
          <EditorSection title="Размеры" summary="В блоках" open>
            <div className="structure-fields">
              <NumberField label="Ширина X" value={instance.parameters.width} min={5} max={129} step={2} onChange={width => update({parameters:{...instance.parameters,width}})} />
              <NumberField label="Длина Z" value={instance.parameters.length} min={5} max={129} step={2} onChange={length => update({parameters:{...instance.parameters,length}})} />
              <NumberField label="Высота Y" value={instance.parameters.height} min={6} max={128} onChange={height => update({parameters:{...instance.parameters,height}})} />
            </div><small>Ширина и длина нечётные. Стены толщиной 1 блок.</small>
          </EditorSection>
          <EditorSection title="Материалы" open>
            {([['wall','Стены'],['floor','Пол'],['ceiling','Потолок']] as const).map(([part,label]) => <label key={part}>{label}<select value={instance.parameters[part].id} onChange={e => update({parameters:{...instance.parameters,[part]:{id:e.target.value,properties:{}}}})}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>)}
          </EditorSection>
          <EditorSection title="Дверные проёмы" summary="3 × 4 блока" open>
            <div className="structure-doors">{directions.map(([d,label]) => <label key={d}><input type="checkbox" checked={instance.parameters.doors[d]} onChange={e => update({parameters:{...instance.parameters,doors:{...instance.parameters.doors,[d]:e.target.checked}}})} />{label}</label>)}</div>
            <small>Направления локальные, до поворота комнаты.</small>
          </EditorSection>
          <EditorSection title="Позиция и поворот" open>
            <div className="structure-fields">{(['x','y','z'] as const).map(axis => <NumberField key={axis} label={axis.toUpperCase()} value={instance.position[axis]} min={-30000000} max={30000000} onChange={n => update({position:{...instance.position,[axis]:n}})} />)}</div>
            <label>Поворот<select value={instance.rotation} onChange={e => update({rotation:Number(e.target.value) as Rotation})}>{[0,90,180,270].map(r => <option key={r} value={r}>{r}°</option>)}</select></label>
            <small>Вокруг локального начала (0, 0, 0). X — восток, Z — юг.</small>
          </EditorSection>
          <button type="button" className="btn" onClick={() => { const remaining=project.instances.filter(i => i.id!==instance.id); if (commit({...project,instances:remaining})) setSelected(remaining[0]?.id ?? null); }}>Удалить комнату</button>
        </div>}
        {error && <p role="alert" className="structure-error">{error}. Изменение не применено.</p>}
      </fieldset></aside>
      <section className="panel structure-view" aria-label="3D-просмотр постройки">
        <StructurePreview cells={result.cells} />
        <div className="structure-status" aria-live="polite"><span>{result.cells.filter(c => c.kind==="solid").length.toLocaleString("ru")} блоков</span><span>{project.instances.length} комнат</span></div>
        {!!result.conflicts.length && <p role="alert" className="structure-error">Пересечение объёмов: {result.conflicts.length.toLocaleString("ru")} ячеек. В просмотре остаётся первая комната. Перемести комнаты, чтобы убрать конфликт.</p>}
        <p className="structure-caption">Текстуры Minecraft Java 26.1.2 для полных блоков. Внутренние грани скрыты. Полёт проходит сквозь стены.</p>
      </section>
    </div>
  </>;
}
