import { ALL_MOBS, RANDOM_BABY_MOBS as BABY_MOBS, SLOTS, type SummonSnapshot } from "./data";

export const PREVIEW_VERSION = "26.1.2";
export const PREVIEW_ROOT = `/entity-preview/${PREVIEW_VERSION}/catalog/`;
export const HORSE_COATS = ["white", "creamy", "chestnut", "brown", "black", "gray", "darkbrown"] as const;
export type SceneEquipment = {
  slot: string; item: string; dye?: string; trim?: { pattern: string; material: string };
  banner?: { base: string; layers: { pattern: string; color: string }[] };
};
export type SceneEntity = {
  id: string; model: string; texture: string; scale: number; scaleSet: boolean; baby: boolean;
  riding: boolean; invisible: boolean; equipment: SceneEquipment[]; warnings: string[];
};
/** The editor snapshot is the source of truth. No command parsing or inferred equipment slots. */
export function buildPreviewScene(snapshot: SummonSnapshot): SceneEntity[] {
  return snapshot.mobOrder.map((mob, i) => {
    const field = (key: string) => snapshot.fields[`${i}-${key}`];
    const flag = (key: string) => field(key) === true || field(key) === "true";
    const id = String(field("mob") || mob.mobType);
    const baby = flag("baby") && BABY_MOBS.has(id);
    const coat = Math.min(6, Math.max(0, Math.trunc(Number(field("horse-coat")) || 0)));
    const equipment: SceneEquipment[] = [];
    for (const slot of SLOTS) {
      const item = String(field(`slot-${slot.key}`) || "");
      if (!item || !(slot.items as readonly string[]).includes(item)) continue;
      equipment.push({ slot: slot.key, item,
        dye: item.startsWith("leather_") && flag(`dyeon-${slot.key}`) ? String(field(`dye-${slot.key}`) || "#a06540") : undefined,
        trim: flag(`trimon-${slot.key}`) ? { pattern: String(field(`trimpat-${slot.key}`) || "sentry"), material: String(field(`trimmat-${slot.key}`) || "iron") } : undefined,
        banner: flag(`shieldon-${slot.key}`) ? { base: String(field(`shieldbase-${slot.key}`) || "white"), layers: Array.from({ length: 16 }, (_, n) => ({ pattern: String(field(`shieldpat-${slot.key}-${n}`) || ""), color: String(field(`shieldcolor-${slot.key}-${n}`) || "black") })).filter(l => l.pattern) } : undefined,
      });
    }
    const warnings: string[] = [];
    if (!isPreviewSupported(id)) warnings.push(`${id}: нет модели в каталоге выбранной версии.`);
    if (id === "area_effect_cloud") warnings.push("Облако эффекта в Minecraft состоит из частиц. Частицы пока не визуализируются; собственной 3D-модели у него нет.");
    if (flag("onfire") || flag("glow")) warnings.push("Огонь и контур свечения пока не визуализируются.");
    const rawScale = Number(field("scale"));
    return { id, model: id + (baby ? "_baby" : ""), texture: id === "horse" ? `horse/horse_${HORSE_COATS[coat]}${baby ? "_baby" : ""}` : "",
      baby, riding: i > 0, invisible: flag("invisible") || flag("eff-invisibility"),
      scaleSet: field("scale") !== "" && field("scale") != null && Number.isFinite(rawScale) && rawScale > 0,
      scale: Number.isFinite(rawScale) && rawScale > 0 ? Math.min(16, Math.max(0.0625, rawScale)) : 1, equipment, warnings };
  });
}
export function isPreviewSupported(id: string) { return Object.prototype.hasOwnProperty.call(ALL_MOBS, id); }

export type PreviewMount = { passenger: number[]; vehicle: number[]; defaultScale: number };
/** Match the passenger's vehicle attachment to its parent's seat, accounting for both scales. */
export function placePreviewEntity(input: SceneEntity, model: PreviewMount, anchor: number[]) {
  const scale = input.scaleSet ? input.scale : model.defaultScale;
  const attachmentScale = scale * (input.baby ? 0.5 : 1);
  const position = anchor.map((n, axis) => n - (input.riding ? model.vehicle[axis] * attachmentScale : 0));
  return { scale, position, next: position.map((n, axis) => n + model.passenger[axis] * attachmentScale) };
}
