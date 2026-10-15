"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildPreviewScene, isPreviewSupported, PREVIEW_ROOT, PREVIEW_VERSION, type SceneEntity } from "./preview-scene";
import type { SummonSnapshot } from "./data";

type Transform = { pivot: number[]; rotation: number[]; scale: number[] };
type Part = Transform & { visible: boolean; faces: { vertices: number[][]; normal: number[] }[]; children: Record<string, Part> };
type Pose = { parts: Record<string, Transform>; hands?: Record<string, number[]> };
type Model = { format: number; minecraft: string; root: Part; poses?: Record<string, Pose> };
type ItemModel = { parent?: string; textures?: Record<string, string>; display?: Record<string, { translation?: number[]; rotation?: number[]; scale?: number[] }> };
// Only JSON promises are retained. GPU resources belong to one scene and are disposed on replacement.
const jsonCache = new Map<string, Promise<unknown>>();
function json<T>(path: string): Promise<T> {
  if (!jsonCache.has(path)) jsonCache.set(path, fetch(PREVIEW_ROOT + path).then(r => { if (!r.ok) throw Error(`Ресурс не найден: ${path}`); return r.json(); }).catch(e => { jsonCache.delete(path); throw e; }));
  return jsonCache.get(path) as Promise<T>;
}
async function texture(path: string) {
  const t = await new THREE.TextureLoader().loadAsync(PREVIEW_ROOT + `textures/${path}.png`);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function dispose(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>(); const materials = new Set<THREE.Material>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); if (m.map) textures.add(m.map); } } });
  materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
function makePart(part: Part, material: THREE.Material, pose?: Pose, path = "root"): THREE.Group {
  const group = new THREE.Group(); group.name = path;
  const t = pose?.parts[path] || part;
  group.position.fromArray(t.pivot).divideScalar(16);
  group.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2], "ZYX"); group.scale.fromArray(t.scale);
  group.visible = part.visible;
  const positions: number[] = [], uvs: number[] = [], normals: number[] = [];
  for (const face of part.faces) for (const index of [0, 1, 2, 0, 2, 3]) {
    const v = face.vertices[index]; positions.push(v[0] / 16, v[1] / 16, v[2] / 16); uvs.push(v[3], 1 - v[4]); normals.push(...face.normal);
  }
  if (positions.length) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    group.add(new THREE.Mesh(geometry, material));
  }
  for (const [name, child] of Object.entries(part.children)) group.add(makePart(child, material, pose, `${path}/${name}`));
  return group;
}
function material(map: THREE.Texture, color?: string) { return new THREE.MeshLambertMaterial({ map, color: color || "#ffffff", alphaTest: 0.1, side: THREE.DoubleSide }); }
async function resolveItem(id: string): Promise<ItemModel> {
  const data = await json<ItemModel>(`models/${id.replace("minecraft:", "")}.json`);
  if (!data.parent || data.parent.startsWith("builtin/")) return data;
  const parent = await resolveItem(data.parent);
  return { ...parent, ...data, textures: { ...parent.textures, ...data.textures }, display: { ...parent.display, ...data.display } };
}
/** Vanilla generated-item silhouette, including pixel edge thickness; no hand-authored item mesh. */
function spriteGeometry(map: THREE.Texture) {
  const img = map.image as HTMLImageElement; const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Не удалось прочитать текстуру предмета");
  ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
  const positions: number[] = [], uv: number[] = [];
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < img.width && y < img.height && pixels[(y * img.width + x) * 4 + 3] > 0;
  function quad(vertices: number[][], tex: number[][]) { for (const i of [0, 1, 2, 0, 2, 3]) { positions.push(...vertices[i]); uv.push(...tex[i]); } }
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (!opaque(x, y)) continue;
    const a = x / img.width, b = (x + 1) / img.width, c = 1 - (y + 1) / img.height, d = 1 - y / img.height, z = 1 / 32;
    const tex = [[a,c],[b,c],[b,d],[a,d]];
    quad([[a,c,z],[b,c,z],[b,d,z],[a,d,z]],tex); quad([[b,c,-z],[a,c,-z],[a,d,-z],[b,d,-z]],[[b,c],[a,c],[a,d],[b,d]]);
    const u = (a + b) / 2, v = (c + d) / 2;
    if (!opaque(x-1,y)) quad([[a,c,-z],[a,c,z],[a,d,z],[a,d,-z]],[[u,c],[u,c],[u,d],[u,d]]);
    if (!opaque(x+1,y)) quad([[b,c,z],[b,c,-z],[b,d,-z],[b,d,z]],[[u,c],[u,c],[u,d],[u,d]]);
    if (!opaque(x,y+1)) quad([[a,c,-z],[b,c,-z],[b,c,z],[a,c,z]],[[a,v],[b,v],[b,v],[a,v]]);
    if (!opaque(x,y-1)) quad([[a,d,z],[b,d,z],[b,d,-z],[a,d,-z]],[[a,v],[b,v],[b,v],[a,v]]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(positions,3)); g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); g.computeVertexNormals(); return g;
}
async function addHeld(entity: THREE.Group, pose: Pose, item: string, slot: string) {
  const data = await resolveItem(`item/${item}`);
  const path = data.textures?.layer0?.replace("minecraft:", ""); if (!path || !pose.hands?.[slot]) throw Error(`Нет крепления предмета ${item}`);
  const map = await texture(path); const mesh = new THREE.Mesh(spriteGeometry(map), material(map));
  mesh.position.set(-0.5,-0.5,0);
  const display = data.display?.[slot === "offhand" ? "thirdperson_lefthand" : "thirdperson_righthand"] || data.display?.thirdperson_righthand;
  const hand = new THREE.Group(); hand.matrix.fromArray(pose.hands[slot]); hand.matrixAutoUpdate = false;
  const transform = new THREE.Group(); const left = slot === "offhand";
  const p = display?.translation || [0,0,0], r = display?.rotation || [0,0,0];
  transform.position.set(p[0] / 16 * (left ? -1 : 1),p[1] / 16,p[2] / 16);
  transform.rotation.set(THREE.MathUtils.degToRad(r[0]),THREE.MathUtils.degToRad(r[1] * (left ? -1 : 1)),THREE.MathUtils.degToRad(r[2] * (left ? -1 : 1)),"XYZ");
  transform.scale.fromArray(display?.scale || [1,1,1]); transform.add(mesh); hand.add(transform); entity.add(hand);
}
async function createEntity(input: SceneEntity) {
  const group = new THREE.Group();
  try {
    const data = await json<Model>(`${input.model}--main.json`);
    if (data.format !== 1 || data.minecraft !== PREVIEW_VERSION) throw Error("Несовместимая версия модели");
    const held = (input.equipment.some(e => e.slot === "mainhand") ? 1 : 0) + (input.equipment.some(e => e.slot === "offhand") ? 2 : 0);
    const pose = data.poses?.[`${input.riding ? "riding" : "standing"}${held}`];
    if (!input.invisible) {
      group.add(makePart(data.root, material(await texture(`entity/${input.texture}`)),pose));
      if (input.id === "villager") group.add(makePart(data.root, material(await texture(input.baby ? "entity/villager/baby/plains" : "entity/villager/type/plains")),pose));
    }
    for (const gear of input.equipment) {
      if (gear.slot.includes("hand")) { if (pose) await addHeld(group,pose,gear.item,gear.slot); continue; }
      const layer = { head:"helmet", chest:"chestplate", legs:"leggings", feet:"boots" }[gear.slot];
      const armor = await json<Model>(`${input.model}--${layer}.json`);
      const type = input.baby ? "humanoid_baby" : gear.slot === "legs" ? "humanoid_leggings" : "humanoid";
      const name = gear.item.split("_")[0].replace("golden","gold");
      group.add(makePart(armor.root,material(await texture(`entity/equipment/${type}/${name}`),gear.dye || (name === "leather" ? "#a06540" : undefined)),pose));
      if (name === "leather") group.add(makePart(armor.root,material(await texture(`entity/equipment/${type}/leather_overlay`)),pose));
    }
    return group;
  } catch (error) { dispose(group); throw error; }
}

type Viewer = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; render: () => void; framedDistance?: number };
export default function EntityPreview({ snapshot }: { snapshot: SummonSnapshot }) {
  const host = useRef<HTMLDivElement>(null); const viewer = useRef<Viewer | null>(null);
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
    const camera = new THREE.PerspectiveCamera(38,1,0.01,1000);
    const controls = new OrbitControls(camera,renderer.domElement); controls.minDistance = 0.15; controls.maxDistance = 150; controls.enablePan = true;
    const render = () => renderer.render(scene,camera); controls.addEventListener("change",render);
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
      let y = 0;
      try {
        // Sequential chain assembly preserves riding order; network JSON is cached per resource.
        for (const input of sceneInput) {
          if (!isPreviewSupported(input.id)) throw Error(`${input.id}: 3D-модель пока не подключена. Вся цепочка доступна в текстовом предпросмотре.`);
          const body = await createEntity(input);
          const renderScale = input.baby ? 1 : input.id === "horse" ? 1.1 : input.id === "villager" ? 0.9375 : 1;
          const scale = input.scale * renderScale;
          const model = new THREE.Group(); model.scale.set(-scale,-scale,scale); model.position.y = y + 1.5 * scale;
          model.add(body); assembly.add(model);
          // Static mount adapter, not a claim of game-exact vehicle attachment logic.
          y += ({ horse:1.45, ravager:2.1, villager:1.75, zombie:1.75, skeleton:1.75 }[input.id] || 1.75) * input.scale * (input.baby ? 0.5 : 1);
        }
        if (cancelled) { dispose(assembly); return; }
        const old = v!.scene.getObjectByName("entities"); if (old) { v!.scene.remove(old); dispose(old); }
        assembly.name = "entities"; v!.scene.add(assembly);
        const box = new THREE.Box3().setFromObject(assembly); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x,size.y,size.z,1); const distance = radius / (2*Math.tan(THREE.MathUtils.degToRad(v!.camera.fov/2))) * 1.5;
        // Retain viewing direction and zoom ratio when state changes.
        const direction = v!.camera.position.clone().sub(v!.controls.target);
        if (!direction.lengthSq()) direction.set(-0.7,0.35,-1);
        const zoom = v!.framedDistance ? direction.length() / v!.framedDistance : 1;
        v!.framedDistance = distance;
        direction.normalize(); v!.camera.position.copy(center).addScaledVector(direction,distance * zoom); v!.controls.target.copy(center); v!.controls.update(); v!.render();
        setStatus("Модель обновлена");
      } catch (error) {
        dispose(assembly); if (cancelled) return;
        const old = v!.scene.getObjectByName("entities"); if (old) { v!.scene.remove(old); dispose(old); } v!.render();
        setStatus(error instanceof Error ? error.message : "Не удалось загрузить модель. Доступен текстовый предпросмотр.");
      }
    }
    void update(); return () => { cancelled = true; };
  },[ready,sceneInput]);
  return <div className="entity-preview">
    <p className="hint">3D · Minecraft Java {PREVIEW_VERSION} · экспериментальный срез</p>
    <div className="entity-preview-canvas" ref={host} />
    <p role="status" className="hint">{status}</p>
    <div className="entity-preview-controls"><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { v.camera.position.sub(v.controls.target).multiplyScalar(0.8).add(v.controls.target); v.controls.update(); v.render(); } }}>Приблизить</button><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { v.camera.position.sub(v.controls.target).multiplyScalar(1.25).add(v.controls.target); v.controls.update(); v.render(); } }}>Отдалить</button><button type="button" className="small" onClick={() => { const v=viewer.current; if(v) { const p=v.camera.position.clone().sub(v.controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4); v.camera.position.copy(v.controls.target).add(p); v.controls.update(); v.render(); } }}>Повернуть</button></div>
    <p className="hint">Вращение — перетаскиванием, приближение — колесом или жестом. Показана статичная поза. Посадка пассажиров приблизительная.</p>
    <details><summary>Ограничения 3D-предпросмотра</summary><p className="hint">Подключены зомби, скелет, лошадь, житель и разоритель. Броня и мечи, топоры, лук, палка показаны только у зомби и скелета. Лук показан без натяжения. Анимации, чары, отделки, огонь, свечение и частицы пока не показаны. Ресурс-паки посетителя не загружаются.</p></details>
    {Array.from(new Set(sceneInput.flatMap(e => e.warnings))).map(message => <p className="hint" key={message}>{message}</p>)}
  </div>;
}
