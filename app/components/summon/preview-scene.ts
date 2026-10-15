import type { SummonSnapshot } from "./data";

export const PREVIEW_VERSION = "26.1.2";
export const PREVIEW_ROOT = `/entity-preview/${PREVIEW_VERSION}/`;
export const HORSE_COATS = ["white", "creamy", "chestnut", "brown", "black", "gray", "darkbrown"] as const;
const supported = new Set(["zombie", "skeleton", "horse", "villager", "ravager"]);
export type SceneEntity = {
  id: string; model: string; texture: string; scale: number; baby: boolean;
  riding: boolean; invisible: boolean; equipment: { slot: string; item: string; dye?: string }[];
  warnings: string[];
};

/** Scene input comes directly from editor fields; the command is never parsed. */
export function buildPreviewScene(snapshot: SummonSnapshot): SceneEntity[] {
  return snapshot.mobOrder.map((mob, i) => {
    const field = (key: string) => snapshot.fields[`${i}-${key}`];
    const flag = (key: string) => field(key) === true || field(key) === "true";
    const id = String(field("mob") || mob.mobType);
    const baby = flag("baby") && ["zombie", "horse", "villager"].includes(id);
    const model = id + (baby ? "_baby" : "");
    const coat = Math.min(6, Math.max(0, Math.trunc(Number(field("horse-coat")) || 0)));
    const texture = id === "horse" ? `horse/horse_${HORSE_COATS[coat]}${baby ? "_baby" : ""}`
      : id === "ravager" ? "illager/ravager" : `${id}/${id}${baby ? "_baby" : ""}`;
    const warnings: string[] = [];
    if (!supported.has(id)) warnings.push(`${id}: 3D-модель пока не подключена. Используйте текстовый предпросмотр.`);
    const humanoid = id === "zombie" || id === "skeleton";
    const equipment: SceneEntity["equipment"] = [];
    for (const slot of ["head", "chest", "legs", "feet", "mainhand", "offhand"]) {
      const item = String(field(`slot-${slot}`) || "");
      if (!item) continue;
      if (!humanoid) {
        warnings.push(id === "villager" && slot === "head"
          ? `Житель: головной предмет ${item} пока не поддерживается в 3D.`
          : `${id}: Minecraft не отображает ${item} в слоте ${slot}.`);
        continue;
      }
      const armorSuffix = { head: "helmet", chest: "chestplate", legs: "leggings", feet: "boots" }[slot];
      const armor = armorSuffix && new RegExp(`^(leather|chainmail|iron|golden|diamond|netherite)_${armorSuffix}$`).test(item);
      const held = slot.includes("hand") && /^(wooden|stone|iron|golden|diamond|netherite)_(sword|axe)$|^(bow|stick)$/.test(item);
      if (!armor && !held) { warnings.push(`${item}: 3D-отображение пока не поддерживается.`); continue; }
      equipment.push({ slot, item, dye: item.startsWith("leather_") && flag(`dyeon-${slot}`) ? String(field(`dye-${slot}`) || "#a06540") : undefined });
      if (flag(`trimon-${slot}`)) warnings.push(`${item}: отделка брони видна только в текстовом предпросмотре.`);
    }
    if (flag("onfire") || flag("glow") || Object.keys(snapshot.fields).some(k => k.startsWith(`${i}-eff-`) && (snapshot.fields[k] === true || snapshot.fields[k] === "true"))) {
      warnings.push("Огонь, свечение, частицы и эффекты не визуализируются в 3D.");
    }
    const rawScale = Number(field("scale"));
    return { id, model, texture, baby, riding: i > 0, invisible: flag("invisible") || flag("eff-invisibility"),
      scale: Number.isFinite(rawScale) && rawScale > 0 ? Math.min(16, Math.max(0.0625, rawScale)) : 1, equipment, warnings };
  });
}
export function isPreviewSupported(id: string) { return supported.has(id); }
