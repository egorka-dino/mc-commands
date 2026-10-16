import { ALL_ITEMS, BANNER_PATTERNS, DYE_COLORS } from "../components/minecraft/data";
import { defaultGiveSnapshot, type GiveSnapshot } from "../components/give/engine";

export function commandAiHistory(value: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap(entry =>
    entry && (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string"
      ? [{ role: entry.role, content: entry.content.slice(0, 1500) }] : []);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Validate the full editor state, including arrays not covered by AI operations.
export function parseGiveAiSnapshot(value: unknown): GiveSnapshot | null {
  if (!record(value) || typeof value.itemId !== "string" || !Object.prototype.hasOwnProperty.call(ALL_ITEMS, value.itemId) ||
      typeof value.target !== "string" || !["@s", "@p", "@a", "@r"].includes(value.target) ||
      typeof value.targetCustom !== "string" || value.targetCustom.length > 120 ||
      typeof value.count !== "string" || !/^\d{1,2}$/.test(value.count) || Number(value.count) < 1 || Number(value.count) > 64 ||
      !record(value.fields) || Object.keys(value.fields).length > 2000 ||
      Object.entries(value.fields).some(([key, field]) => !/^[a-z0-9-]{1,100}$/.test(key) ||
        !(typeof field === "boolean" || (typeof field === "number" && Number.isFinite(field)) || (typeof field === "string" && field.length <= 2000))) ||
      !Array.isArray(value.shieldLayers) || value.shieldLayers.length > 16 ||
      !Array.isArray(value.explosions) || value.explosions.length > 8 ||
      (typeof value.potionType !== "string" || !["potion", "splash_potion", "lingering_potion", "tipped_arrow"].includes(value.potionType)) ||
      (typeof value.potionModifier !== "string" || !["normal", "long", "strong"].includes(value.potionModifier))) return null;
  const colors = new Set<string>(DYE_COLORS.map(([id]) => id));
  const patterns = new Set<string>(BANNER_PATTERNS.map(([id]) => id));
  const hexes = (entries: unknown) => Array.isArray(entries) && entries.length <= 8 && entries.every(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color));
  if (value.shieldLayers.some(layer => !record(layer) || typeof layer.id !== "number" || !Number.isFinite(layer.id) || (typeof layer.pattern !== "string" || !patterns.has(layer.pattern)) || (typeof layer.color !== "string" || !colors.has(layer.color))) ||
      value.explosions.some(explosion => !record(explosion) || typeof explosion.id !== "number" || !Number.isFinite(explosion.id) ||
        (typeof explosion.shape !== "string" || !["small_ball", "large_ball", "star", "creeper", "burst"].includes(explosion.shape)) || !hexes(explosion.colors) || !hexes(explosion.fadeColors) ||
        typeof explosion.trail !== "boolean" || typeof explosion.twinkle !== "boolean")) return null;
  const raw = value as unknown as GiveSnapshot;
  return structuredClone({ ...defaultGiveSnapshot(), ...raw });
}
