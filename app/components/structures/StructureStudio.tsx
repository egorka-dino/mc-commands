"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
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
  const [selected,setSelected] = useState<string | null>(null);
  const [error,setError] = useState("");
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
    <p className="structure-notice">Экспериментальный редактор. Сцена живёт в этой вкладке и исчезнет после обновления страницы. Сохранение и экспорт появятся позже.</p>
    <div className="structure-studio">
      <aside className="panel structure-settings" aria-label="Настройки постройки">
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
      </aside>
      <section className="panel structure-view" aria-label="3D-просмотр постройки">
        <StructurePreview cells={result.cells} />
        <div className="structure-status" aria-live="polite"><span>{result.cells.filter(c => c.kind==="solid").length.toLocaleString("ru")} блоков</span><span>{project.instances.length} комнат</span></div>
        {!!result.conflicts.length && <p role="alert" className="structure-error">Пересечение объёмов: {result.conflicts.length.toLocaleString("ru")} ячеек. В просмотре остаётся первая комната. Перемести комнаты, чтобы убрать конфликт.</p>}
        <p className="structure-caption">Цветовая схема полных блоков без игровых текстур. Внутренние грани скрыты. Полёт проходит сквозь стены.</p>
      </section>
    </div>
  </>;
}
