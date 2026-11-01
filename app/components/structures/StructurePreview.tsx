"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import type { Cell } from "../../structure-core";
import { flightStep, MATERIALS, SectionMesher } from "./scene-geometry";

// Three's base lock() discards the promise returned by modern browsers.
class SafePointerLockControls extends PointerLockControls {
  constructor(camera:THREE.Camera, element:HTMLElement, private reportError:()=>void) { super(camera,element); }
  override lock(unadjustedMovement=false) {
    try {
      const pending=this.domElement!.requestPointerLock({unadjustedMovement});
      if (pending) void pending.catch(this.reportError);
    } catch { this.reportError(); }
  }
}

type Viewer = { update:(cells:Cell[])=>void; fit:()=>void; fly:()=>void };
const movementKeys = new Set(["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft","ShiftRight"]);

export default function StructurePreview({cells}:{cells:Cell[]}) {
  const host=useRef<HTMLDivElement>(null), viewer=useRef<Viewer|null>(null);
  const latestCells=useRef(cells); latestCells.current=cells;
  const speed=useRef(12);
  const [speedValue,setSpeedValue]=useState(12), [locked,setLocked]=useState(false);
  const [error,setError]=useState(""), [flightError,setFlightError]=useState("");
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    const container=host.current!;
    let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({antialias:true}); }
    catch { setError("WebGL недоступен. Включи аппаратное ускорение или открой страницу в браузере с поддержкой WebGL 2. Настройки комнаты доступны без 3D."); return; }
    setError("");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
    renderer.setClearColor("#141c26");
    container.appendChild(renderer.domElement);
    const canvas=renderer.domElement;
    canvas.setAttribute("aria-label","3D-сцена Structure Studio");
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(55,1,0.1,1000000);
    camera.position.set(24,20,28);
    const orbit=new OrbitControls(camera,canvas);
    orbit.target.set(5,3,5); orbit.enableDamping=true; orbit.maxDistance=100000;
    const fly=new SafePointerLockControls(camera,canvas,() => onPointerError());
    const grid=new THREE.GridHelper(160,80,0x456079,0x263747); grid.position.y=-0.02;
    scene.add(grid,new THREE.HemisphereLight(0xe3efff,0x66717e,2.2));
    const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(20,40,15); scene.add(sun);
    const mesher=new SectionMesher(), chunks=new Map<string,THREE.Group>();
    const materials=new Map(MATERIALS.map(m => [m.id as string,new THREE.MeshLambertMaterial({color:m.color,vertexColors:true})]));
    const fallback=new THREE.MeshLambertMaterial({color:0x999999,vertexColors:true});
    const bounds=new THREE.Box3(), center=new THREE.Vector3(), direction=new THREE.Vector3();
    let fitted=false, stopped=false, frame=0, lastTime=0;
    const keys=new Set<string>();
    const disposeChunk=(group:THREE.Group) => {
      group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); scene.remove(group);
    };
    const fit=() => {
      keys.clear(); if (fly.isLocked) fly.unlock();
      if (bounds.isEmpty()) { orbit.target.set(5,3,5); camera.position.set(24,20,28); }
      else {
        bounds.getCenter(center); const size=bounds.getSize(new THREE.Vector3());
        const radius=Math.max(size.length()/2,4);
        const distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(camera.aspect,1);
        orbit.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(1,0.8,1).normalize().multiplyScalar(distance*1.15));
        grid.position.set(center.x,bounds.min.y-0.02,center.z);
      }
      orbit.update();
    };
    const update=(next:Cell[]) => {
      const dirty=mesher.update(next);
      for (const s of dirty) {
        const old=chunks.get(s); if (old) { disposeChunk(old); chunks.delete(s); }
        const data=mesher.sections.get(s); if (!data) continue;
        const group=new THREE.Group(); group.position.set(data.origin.x,data.origin.y,data.origin.z);
        for (const surface of data.surfaces) {
          const geometry=new THREE.BufferGeometry();
          geometry.setAttribute("position",new THREE.Float32BufferAttribute(surface.positions,3));
          geometry.setAttribute("normal",new THREE.Float32BufferAttribute(surface.normals,3));
          geometry.setAttribute("color",new THREE.Float32BufferAttribute(surface.shades,3));
          geometry.computeBoundingSphere();
          group.add(new THREE.Mesh(geometry,materials.get(surface.material) ?? fallback));
        }
        chunks.set(s,group); scene.add(group);
      }
      bounds.makeEmpty();
      for (const c of next) if (c.kind==="solid") {
        bounds.expandByPoint(new THREE.Vector3(c.position.x,c.position.y,c.position.z));
        bounds.expandByPoint(new THREE.Vector3(c.position.x+1,c.position.y+1,c.position.z+1));
      }
      if (!fitted && !bounds.isEmpty()) { fit(); fitted=true; }
      if (bounds.isEmpty()) fitted=false;
    };
    const onLock=() => { orbit.enabled=false; keys.clear(); setLocked(true); setFlightError(""); };
    const onUnlock=() => {
      keys.clear(); setLocked(false);
      camera.getWorldDirection(direction); orbit.target.copy(camera.position).addScaledVector(direction,10);
      orbit.enabled=true; orbit.update();
    };
    const onKeyDown=(e:KeyboardEvent) => { if (fly.isLocked && movementKeys.has(e.code)) { e.preventDefault(); keys.add(e.code); } };
    const onKeyUp=(e:KeyboardEvent) => { keys.delete(e.code); };
    const onBlur=() => { keys.clear(); if (fly.isLocked) fly.unlock(); };
    const onVisibility=() => { if (document.hidden) onBlur(); };
    const onPointerError=() => { keys.clear(); setFlightError("Браузер не разрешил захват мыши. Нажми 'Свободный полёт' ещё раз или используй обзор мышью."); };
    const onContextLost=(e:Event) => {
      e.preventDefault(); stopped=true; cancelAnimationFrame(frame); onBlur();
      setError("Контекст WebGL потерян. Настройки сцены сохранены в этой вкладке. Нажми 'Повторить 3D', чтобы восстановить просмотр.");
    };
    fly.addEventListener("lock",onLock); fly.addEventListener("unlock",onUnlock);
    window.addEventListener("keydown",onKeyDown); window.addEventListener("keyup",onKeyUp); window.addEventListener("blur",onBlur);
    document.addEventListener("visibilitychange",onVisibility); document.addEventListener("pointerlockerror",onPointerError);
    canvas.addEventListener("webglcontextlost",onContextLost);
    const resize=() => {
      const width=Math.max(container.clientWidth,1), height=Math.max(container.clientHeight,1);
      camera.aspect=width/height; camera.updateProjectionMatrix(); renderer.setSize(width,height);
    };
    const observer=new ResizeObserver(resize); observer.observe(container); resize();
    const animate=(time:number) => {
      if (stopped) return;
      const delta=lastTime ? (time-lastTime)/1000 : 0; lastTime=time;
      if (fly.isLocked) {
        const yaw=new THREE.Euler().setFromQuaternion(camera.quaternion,"YXZ").y;
        const step=flightStep(keys,yaw,speed.current,delta); camera.position.add(new THREE.Vector3(step.x,step.y,step.z));
      } else orbit.update();
      renderer.render(scene,camera); frame=requestAnimationFrame(animate);
    };
    viewer.current={ update,fit,fly:() => { if (!stopped && !fly.isLocked) { orbit.update(); fly.lock(); } } };
    update(latestCells.current); frame=requestAnimationFrame(animate);
    return () => {
      stopped=true; cancelAnimationFrame(frame); viewer.current=null; keys.clear();
      fly.removeEventListener("lock",onLock); fly.removeEventListener("unlock",onUnlock);
      if (fly.isLocked) fly.unlock(); fly.dispose(); orbit.dispose(); observer.disconnect();
      window.removeEventListener("keydown",onKeyDown); window.removeEventListener("keyup",onKeyUp); window.removeEventListener("blur",onBlur);
      document.removeEventListener("visibilitychange",onVisibility); document.removeEventListener("pointerlockerror",onPointerError);
      canvas.removeEventListener("webglcontextlost",onContextLost);
      for (const group of chunks.values()) disposeChunk(group);
      for (const material of materials.values()) material.dispose(); fallback.dispose();
      grid.geometry.dispose(); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => m.dispose());
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  },[attempt]);
  useEffect(() => { viewer.current?.update(cells); },[cells]);
  return <>
    <div className="structure-toolbar">
      <button type="button" className="btn" disabled={!!error} onClick={() => viewer.current?.fit()}>Показать всю сцену</button>
      <button type="button" className="btn" disabled={!!error || locked} onClick={() => viewer.current?.fly()}>{locked ? "Полёт · Escape для выхода" : "Свободный полёт"}</button>
      <label>Скорость, блоков/с<input type="range" min={1} max={60} value={speedValue} onChange={e => { speed.current=Number(e.target.value); setSpeedValue(speed.current); }} /><output>{speedValue}</output></label>
    </div>
    <div className="structure-canvas-wrap">
      <div className="structure-canvas" ref={host} />
      {locked && <span className="structure-crosshair" aria-hidden="true">+</span>}
      {error && <div className="structure-webgl-error" role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => { setLocked(false); setAttempt(n => n+1); }}>Повторить 3D</button></div>}
      {!cells.length && !error && <p className="structure-empty">Твоя новая постройка начинается здесь<br /><small>Добавь Stone Room в настройках сцены</small></p>}
    </div>
    <p className="structure-caption">Обзор: тяни мышью для вращения, колесо — масштаб, правая кнопка — перемещение. Полёт: WASD, Space — вверх, Shift — вниз, мышь — взгляд, Escape — выход.</p>
    {flightError && <p role="alert" className="structure-error">{flightError}</p>}
  </>;
}
