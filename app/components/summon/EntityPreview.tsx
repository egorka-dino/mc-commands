"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildPreviewScene, placePreviewEntity, isPreviewSupported, PREVIEW_ROOT, PREVIEW_VERSION, type SceneEntity } from "./preview-scene";
import { DYE_COLORS, type SummonSnapshot } from "./data";

type CapturedMesh = { vertices: number[][]; texture?: string; pipeline: string };
type CapturedPose = { body: string[]; attachments: Record<string, { matrix: number[]; context: string }>; equipment: Record<string, Record<string, string[]>> };
type EntityModel = { format: number; minecraft: string; billboard?: boolean; poses: Record<string, CapturedPose>; passenger: number[]; vehicle: number[]; height: number; defaultScale: number };
const jsonCache = new Map<string, Promise<unknown>>();
function json<T>(path: string): Promise<T> {
  if (!jsonCache.has(path)) jsonCache.set(path, fetch(PREVIEW_ROOT + path).then(r => { if (!r.ok) throw Error(`Ресурс не найден: ${path}`); return r.json(); }).catch(e => { jsonCache.delete(path); throw e; }));
  return jsonCache.get(path) as Promise<T>;
}
async function texture(path: string) {
  const t = await new THREE.TextureLoader().loadAsync(PREVIEW_ROOT + path.replace("minecraft:", ""));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function dispose(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>(); const materials = new Set<THREE.Material>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); if (m.map) textures.add(m.map); } } });
  materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
async function capturedMesh(data: CapturedMesh, options: { texture?: string; color?: string; overlay?: boolean } = {}) {
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], normals: number[] = [];
  const color = new THREE.Color();
  for (let q = 0; q < data.vertices.length; q += 4) for (const offset of [0,1,2,0,2,3]) {
    const v = data.vertices[q + offset]; positions.push(v[0],v[1],v[2]); uvs.push(v[3],1-v[4]); normals.push(v[5],v[6],v[7]);
    color.setRGB(options.color ? 1 : v[8], options.color ? 1 : v[9], options.color ? 1 : v[10]).convertSRGBToLinear(); colors.push(color.r,color.g,color.b,v[11]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2)); geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normals,3)); geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,4));
  try {
    const path=options.texture || data.texture;
    const mat=new THREE.MeshBasicMaterial({ map:path ? await texture(path) : null, color:options.color || "#ffffff", vertexColors:true, side:THREE.DoubleSide, alphaTest:0.01, transparent:data.pipeline.includes("translucent") || !path || data.vertices.some(v=>v[11]<1), polygonOffset:!!options.overlay, polygonOffsetFactor:options.overlay ? -1 : 0, polygonOffsetUnits:options.overlay ? -1 : 0 });
    const mesh=new THREE.Mesh(geometry,mat); if(options.overlay)mesh.renderOrder=1; return mesh;
  } catch(e) { geometry.dispose(); throw e; }
}
const dyeColors = Object.fromEntries(DYE_COLORS.map(([id,,hex]) => [id,hex]));
async function addMeshes(group: THREE.Group, refs: string[], input: SceneEntity, gear?: SceneEntity["equipment"][number]) {
  const data=await Promise.all(refs.map(ref => json<CapturedMesh>(`meshes/${ref}.json`)));
  for(const m of data) {
    let path=m.texture; let color: string | undefined;
    if(!gear && input.id==="horse" && path?.includes("/horse/horse_"))path=`minecraft:textures/entity/${input.texture}.png`;
    if(gear?.dye && path?.endsWith("/leather.png"))color=gear.dye;
    if(gear?.banner && path?.endsWith("/banner/base.png"))color=dyeColors[gear.banner.base];
    if(gear?.banner && path?.endsWith("/shield/shield_base_nopattern.png"))path="minecraft:textures/entity/shield/shield_base.png";
    group.add(await capturedMesh(m,{texture:path,color}));
    // Vanilla applies armor trims to the same armor surface, except its separate baby layer.
    if(gear?.trim && path?.includes("/equipment/humanoid") && !path.includes("humanoid_baby") && !path.includes("overlay")) {
      const layer=path.includes("humanoid_leggings") ? "humanoid_leggings" : "humanoid";
      const armor=gear.item.split("_")[0].replace("golden","gold"); const mat=gear.trim.material;
      const palette=mat+(armor===mat && ["iron","gold","diamond","netherite"].includes(mat) ? "_darker" : "");
      group.add(await capturedMesh(m,{texture:`minecraft:textures/trims/entity/${layer}/${gear.trim.pattern}_${palette}.png`,color:"#ffffff",overlay:true}));
    }
    if(gear?.banner && (path?.endsWith("/banner/base.png") || path?.endsWith("/shield/shield_base.png"))) {
      const folder=gear.item==="shield" ? "shield" : "banner";
      const layers=folder==="shield" ? [{pattern:"base",color:gear.banner.base},...gear.banner.layers] : gear.banner.layers;
      for(const layer of layers)group.add(await capturedMesh(m,{texture:`minecraft:textures/entity/${folder}/${layer.pattern}.png`,color:dyeColors[layer.color] || "#ffffff",overlay:true}));
    }
  }
}
async function createEntity(input: SceneEntity) {
  const group=new THREE.Group(); const warnings: string[]=[];
  try {
    const data=await json<EntityModel>(`entities/${input.id}.json`);
    if(data.format!==3 || data.minecraft!==PREVIEW_VERSION)throw Error("Несовместимая версия модели");
    group.userData.previewBillboard=!!data.billboard;
    const held=(input.equipment.some(e=>e.slot==="mainhand")?1:0)+(input.equipment.some(e=>e.slot==="offhand")?2:0);
    const crossbow=input.id==="pillager" && input.equipment.some(e=>e.slot.endsWith("hand") && e.item==="crossbow");
    const pose=data.poses[`${input.baby ? "baby-" : ""}${input.riding ? "riding" : "standing"}${held}${crossbow ? "-crossbow" : ""}`];
    if(!pose)throw Error(`Нет позы для ${input.model}`);
    if(!input.invisible)await addMeshes(group,pose.body,input);
    for(const gear of input.equipment) {
      const attachment=pose.attachments[gear.slot];
      if(gear.slot.endsWith("hand") && attachment) {
        const items=await json<Record<string,string[]>>(`items/${gear.item}.json`);const mount=new THREE.Group();mount.matrix.fromArray(attachment.matrix);mount.matrixAutoUpdate=false;group.add(mount);await addMeshes(mount,items[attachment.context],input,gear);
      } else {
        const refs=pose.equipment[gear.slot]?.[gear.item];
        if(refs)await addMeshes(group,refs,input,gear);
        else warnings.push(`${input.id}: Minecraft не отображает ${gear.item} в слоте ${gear.slot} в этой позе.`);
      }
    }
    return {group,passenger:data.passenger,vehicle:data.vehicle || [0,0,0],height:data.height,defaultScale:data.defaultScale || 1,warnings};
  } catch(error) {dispose(group);throw error;}
}

type Viewer = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; render: () => void; framedDistance?: number };
export default function EntityPreview({ snapshot }: { snapshot: SummonSnapshot }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  function toggleExpanded() {
    const element = dialog.current;
    if (!element) return;
    element.close();
    if (expanded) { element.show(); } else { element.showModal(); }
    setExpanded(!expanded);
    expandButton.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);
  const host = useRef<HTMLDivElement>(null); const viewer = useRef<Viewer | null>(null);
  const [sceneWarnings,setSceneWarnings] = useState<string[]>([]);
  const [ready,setReady] = useState(false); const [status,setStatus] = useState("Загрузка 3D…");
  const inputs = buildPreviewScene(snapshot); const sceneKey = JSON.stringify(inputs);
  const sceneInput = useMemo(() => JSON.parse(sceneKey) as SceneEntity[],[sceneKey]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true }); } catch { setStatus("3D недоступно: браузер не поддерживает WebGL. Ниже сохранён текстовый предпросмотр."); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); element.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-label","3D-модель Minecraft. Перетащите для вращения, используйте колесо для приближения."); renderer.domElement.setAttribute("role","img");
    const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff,2));
    const light = new THREE.DirectionalLight(0xffffff,2.5); light.position.set(-3,5,-4); scene.add(light);
    const camera = new THREE.PerspectiveCamera(38,1,0.01,100000);
    const controls = new OrbitControls(camera,renderer.domElement); controls.minDistance = 0.15; controls.maxDistance = 10000; controls.enablePan = true;
    const render = () => { scene.traverse(object => { if(object.userData.previewBillboard)object.quaternion.copy(camera.quaternion); }); renderer.render(scene,camera); }; controls.addEventListener("change",render);
    const resize = new ResizeObserver(() => { const {width,height} = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width,height,false); camera.aspect = width/height; camera.updateProjectionMatrix(); render(); }); resize.observe(element);
    const lost = (e: Event) => { e.preventDefault(); setStatus("Графический контекст потерян. Доступен текстовый предпросмотр; перезагрузите страницу для 3D."); };
    renderer.domElement.addEventListener("webglcontextlost",lost);
    viewer.current = { scene,camera,controls,render }; setReady(true);
    return () => { viewer.current = null; resize.disconnect(); controls.dispose(); renderer.domElement.removeEventListener("webglcontextlost",lost); dispose(scene); renderer.dispose(); renderer.domElement.remove(); };
  },[]);
  useEffect(() => {
    const v = viewer.current; if (!ready || !v) return;
    let cancelled = false; const assembly = new THREE.Group(); setStatus("Обновление 3D…");
    async function update() {
      let anchor=[0,0,0]; const warnings: string[]=[];
      try {
        // Sequential chain assembly preserves riding order; network JSON is cached per resource.
        for (const input of sceneInput) {
          if (!isPreviewSupported(input.id)) throw Error(`${input.id}: 3D-модель пока не подключена. Вся цепочка доступна в текстовом предпросмотре.`);
          const body = await createEntity(input); warnings.push(...body.warnings);
          const placement=placePreviewEntity(input,body,anchor);
          const model = new THREE.Group(); model.scale.setScalar(placement.scale); model.position.fromArray(placement.position);
          model.add(body.group); assembly.add(model);
          anchor=placement.next;

        }
        if (cancelled) { dispose(assembly); return; }
        const old = v!.scene.getObjectByName("entities"); if (old) { v!.scene.remove(old); dispose(old); }
        assembly.name = "entities"; v!.scene.add(assembly);
        const box = new THREE.Box3().setFromObject(assembly); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x,size.y,size.z,1); const distance = radius / (2*Math.tan(THREE.MathUtils.degToRad(v!.camera.fov/2))) * 1.5;
        // Retain viewing direction and zoom ratio when state changes.
        const direction = v!.camera.position.clone().sub(v!.controls.target);
        if (!v!.framedDistance || !direction.lengthSq()) direction.set(-0.7,0.35,1);
        const zoom = v!.framedDistance ? direction.length() / v!.framedDistance : 1;
        v!.framedDistance = distance;
        direction.normalize(); v!.camera.position.copy(center).addScaledVector(direction,distance * zoom); v!.controls.target.copy(center); v!.controls.update(); v!.framedDistance=v!.camera.position.distanceTo(v!.controls.target)/zoom; v!.render();
        setSceneWarnings(warnings); setStatus("Модель обновлена");
      } catch (error) {
        dispose(assembly); if (cancelled) return;
        const old = v!.scene.getObjectByName("entities"); if (old) { v!.scene.remove(old); dispose(old); } v!.render();
        setSceneWarnings([]); setStatus(`Не удалось обновить 3D${error instanceof Error ? `: ${error.message}` : ""}. Доступен текстовый предпросмотр.`);
      }
    }
    void update(); return () => { cancelled = true; };
  },[ready,sceneInput]);
  return <dialog open ref={dialog} className="entity-preview" aria-labelledby={titleId} aria-modal={expanded} onCancel={event => { event.preventDefault(); if (expanded) toggleExpanded(); }}>
    <div className="entity-preview-header"><p id={titleId} className="hint">3D · Minecraft Java {PREVIEW_VERSION} · каталог конструктора</p><button ref={expandButton} type="button" className="small" aria-expanded={expanded} onClick={toggleExpanded}>{expanded ? "Свернуть" : "Развернуть"}</button></div>
    <div className="entity-preview-canvas" ref={host} />
    <p role="status" className="hint">{status}</p>
    <div className="entity-preview-controls"><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { v.camera.position.sub(v.controls.target).multiplyScalar(0.8).add(v.controls.target); v.controls.update(); v.render(); } }}>Приблизить</button><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { v.camera.position.sub(v.controls.target).multiplyScalar(1.25).add(v.controls.target); v.controls.update(); v.render(); } }}>Отдалить</button><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { const p=v.camera.position.clone().sub(v.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4); v.camera.position.copy(v.controls.target).add(p); v.controls.update(); v.render(); } }}>Повернуть</button></div>
    <div className="entity-preview-notes"><p className="hint">Вращение — перетаскиванием, приближение — колесом или жестом. Показана статичная поза. Посадка использует точки крепления Minecraft; особые позы транспорта пока не воспроизводятся.</p>
    <details><summary>Ограничения 3D-предпросмотра</summary><p className="hint">Модели всех 94 сущностей каталога и 69 предметов экипировки извлечены из Minecraft Java 26.1.2. Слои брони и крепления предметов берутся из игрового рендерера. Облако эффекта состоит только из частиц. Анимации, чары, огонь, контур свечения и частицы пока не показаны. Щиты и флаги поддерживают узоры, броня — окраску и отделку. В этой версии Minecraft отделка на детской броне не отображается. Скины голов игроков из сети и ресурс-паки посетителя не загружаются.</p></details>
    {Array.from(new Set([...sceneInput.flatMap(e => e.warnings),...sceneWarnings])).map(message => <p className="hint" key={message}>{message}</p>)}
    </div>
  </dialog>;
}
