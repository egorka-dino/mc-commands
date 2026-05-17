import {
  BANNER_PATTERNS,
  canHaveTrim,
  DYE_COLORS,
  EFFECTS,
  enchantsForItem,
  isFireball,
  supportsBannerPatterns,
  ITEM_NAMES,
  SLOTS,
  type SummonFieldValue,
  type SummonSnapshot,
} from "./data";

type EnchantSelection = { id: string; lvl: number };

function read(snapshot: SummonSnapshot, index: number, field: string): SummonFieldValue | undefined {
  return snapshot.fields[`${index}-${field}`];
}

function hasValue(value: SummonFieldValue | undefined): value is string | number | boolean {
  return value !== undefined && value !== null && value !== "" && value !== false;
}

function asString(value: SummonFieldValue | undefined) {
  return value === undefined || value === null ? "" : String(value);
}

function asBool(value: SummonFieldValue | undefined) {
  return value === true || value === "true";
}

function enchantSelections(snapshot: SummonSnapshot, index: number, slotKey: string): EnchantSelection[] {
  const prefix = `${index}-ench-${slotKey}-`;
  return Object.keys(snapshot.fields)
    .filter((key) => key.startsWith(prefix) && asBool(snapshot.fields[key]))
    .map((key) => {
      const id = key.substring(prefix.length);
      const lvl = Number.parseInt(asString(read(snapshot, index, `enchlvl-${slotKey}-${id}`)), 10) || 1;
      return { id, lvl };
    });
}

export function buildNBTPartsFor(snapshot: SummonSnapshot, index: number) {
  const parts: string[] = [];
  const mobType = asString(read(snapshot, index, "mob")) || snapshot.mobOrder[index]?.mobType || "zombie";

  const name = asString(read(snapshot, index, "name")).trim();
  if (name) {
    const color = asString(read(snapshot, index, "name-color"));
    const nameObj: { text: string; color?: string; bold?: boolean; italic?: boolean } = { text: name };
    if (color) nameObj.color = color;
    if (asBool(read(snapshot, index, "name-bold"))) nameObj.bold = true;
    if (asBool(read(snapshot, index, "name-italic"))) nameObj.italic = true;
    parts.push(`CustomName:${JSON.stringify(nameObj)}`);
    if (asBool(read(snapshot, index, "name-visible"))) parts.push("CustomNameVisible:1b");
  }

  if (asBool(read(snapshot, index, "baby"))) parts.push("IsBaby:1b");
  if (asBool(read(snapshot, index, "invul"))) parts.push("Invulnerable:1b");
  if (asBool(read(snapshot, index, "invisible"))) parts.push("Invisible:1b");
  if (asBool(read(snapshot, index, "silent"))) parts.push("Silent:1b");
  if (asBool(read(snapshot, index, "noai"))) parts.push("NoAI:1b");
  if (asBool(read(snapshot, index, "noburn"))) parts.push("Fire:-1s");
  if (asBool(read(snapshot, index, "onfire"))) parts.push("Fire:32767s");
  if (asBool(read(snapshot, index, "glow"))) parts.push("Glowing:1b");
  if (asBool(read(snapshot, index, "nogravity"))) parts.push("NoGravity:1b");
  if (asBool(read(snapshot, index, "persist"))) parts.push("PersistenceRequired:1b");
  if (asBool(read(snapshot, index, "nobreath"))) parts.push("Air:32767s");
  if (asBool(read(snapshot, index, "boss"))) parts.push('Tags:["boss"]');

  const attrs: string[] = [];
  const health = asString(read(snapshot, index, "health"));
  if (health) {
    parts.push(`Health:${Number.parseFloat(health).toFixed(1)}f`);
    attrs.push(`{id:"minecraft:max_health",base:${Number.parseFloat(health)}}`);
  }
  const attrMap = [
    ["speed", "minecraft:movement_speed", Number.parseFloat],
    ["armor", "minecraft:armor", Number.parseInt],
    ["attack", "minecraft:attack_damage", Number.parseFloat],
    ["kb", "minecraft:knockback_resistance", Number.parseFloat],
    ["scale", "minecraft:scale", Number.parseFloat],
  ] as const;
  attrMap.forEach(([field, id, parser]) => {
    const value = asString(read(snapshot, index, field));
    if (value) attrs.push(`{id:"${id}",base:${parser(value)}}`);
  });
  if (attrs.length) parts.push(`attributes:[${attrs.join(",")}]`);

  if (isFireball(mobType)) {
    const power = ["power-x", "power-y", "power-z"].map((field, fallbackIndex) => {
      const fallback = fallbackIndex === 2 ? "1.0" : "0.0";
      const n = Number.parseFloat(asString(read(snapshot, index, field)) || fallback);
      return Number.isFinite(n) ? n.toFixed(1) : fallback;
    });
    const explosionPower = Number.parseInt(asString(read(snapshot, index, "explosion-power")) || "1", 10);
    parts.push(`Power:[${power.join(",")}]`);
    if (!Number.isNaN(explosionPower)) parts.push(`ExplosionPower:${explosionPower}`);
  }

  const equipParts: string[] = [];
  const dropParts: string[] = [];
  SLOTS.forEach((slot) => {
    const itemId = asString(read(snapshot, index, `slot-${slot.key}`));
    if (itemId) {
      const enchants = enchantSelections(snapshot, index, slot.key).map(({ id, lvl }) => `${id}:${lvl}`);
      const count = Number.parseInt(asString(read(snapshot, index, `count-${slot.key}`)), 10) || 1;
      const comps: string[] = [];
      if (enchants.length) comps.push(`enchantments:{${enchants.join(",")}}`);
      if (itemId.startsWith("leather_") && asBool(read(snapshot, index, `dyeon-${slot.key}`))) {
        const hex = (asString(read(snapshot, index, `dye-${slot.key}`)) || "#a06540").replace("#", "");
        comps.push(`"minecraft:dyed_color":${Number.parseInt(hex, 16)}`);
      }
      if (canHaveTrim(itemId) && asBool(read(snapshot, index, `trimon-${slot.key}`))) {
        const mat = asString(read(snapshot, index, `trimmat-${slot.key}`)) || "iron";
        const pat = asString(read(snapshot, index, `trimpat-${slot.key}`)) || "sentry";
        comps.push(`"minecraft:trim":{material:"${mat}",pattern:"${pat}"}`);
      }
      if (supportsBannerPatterns(itemId) && asBool(read(snapshot, index, `shieldon-${slot.key}`))) {
        const base = asString(read(snapshot, index, `shieldbase-${slot.key}`)) || "white";
        const validColors = new Set<string>(DYE_COLORS.map(([id]) => id));
        const validPatterns = new Set<string>(BANNER_PATTERNS.map(([id]) => id));
        const layers = Array.from({ length: 16 }, (_, layerIndex) => {
          const pattern = asString(read(snapshot, index, `shieldpat-${slot.key}-${layerIndex}`)) || "";
          const color = asString(read(snapshot, index, `shieldcolor-${slot.key}-${layerIndex}`)) || "black";
          if (!validPatterns.has(pattern) || !validColors.has(color)) return "";
          return `{pattern:"minecraft:${pattern}",color:"${color}"}`;
        }).filter(Boolean);
        if (validColors.has(base)) comps.push(`base_color:"${base}"`);
        if (layers.length) comps.push(`banner_patterns:[${layers.join(",")}]`);
      }
      equipParts.push(`${slot.key}:{id:${itemId},count:${count}${comps.length ? `,components:{${comps.join(",")}}` : ""}}`);
    }

    const dropVal = Number.parseFloat(asString(read(snapshot, index, `drop-${slot.key}`)));
    if (!Number.isNaN(dropVal) && dropVal !== 0) dropParts.push(`${slot.key}:${dropVal.toFixed(2)}f`);
  });
  if (equipParts.length) parts.push(`equipment:{${equipParts.join(",")}}`);
  if (dropParts.length) parts.push(`drop_chances:{${dropParts.join(",")}}`);

  const effects: string[] = [];
  EFFECTS.forEach(([eid]) => {
    if (!asBool(read(snapshot, index, `eff-${eid}`))) return;
    const amp = Number.parseInt(asString(read(snapshot, index, `effamp-${eid}`)), 10) || 0;
    const dur = Number.parseInt(asString(read(snapshot, index, `effdur-${eid}`)), 10) || 999999;
    effects.push(`{id:"minecraft:${eid}",amplifier:${amp},duration:${dur},show_particles:1b}`);
  });
  if (effects.length) parts.push(`active_effects:[${effects.join(",")}]`);

  return parts;
}

export function buildSummonCommand(snapshot: SummonSnapshot, coords = "~ ~ ~") {
  if (!snapshot.mobOrder.length) return "";

  function buildAt(index: number): string[] {
    const parts = buildNBTPartsFor(snapshot, index);
    if (index < snapshot.mobOrder.length - 1) {
      const nextParts = buildAt(index + 1);
      const nextId = snapshot.mobOrder[index + 1]?.mobType || "zombie";
      parts.push(`Passengers:[{id:"minecraft:${nextId}"${nextParts.length ? `,${nextParts.join(",")}` : ""}}]`);
    }
    return parts;
  }

  const mainType = snapshot.mobOrder[0]?.mobType || "zombie";
  const mainParts = buildAt(0);
  const nbt = mainParts.length ? ` {${mainParts.join(", ")}}` : "";
  return `/summon minecraft:${mainType} ${coords.trim() || "~ ~ ~"}${nbt}`;
}

export function getPreviewData(snapshot: SummonSnapshot, index: number) {
  const mobType = asString(read(snapshot, index, "mob")) || snapshot.mobOrder[index]?.mobType || "zombie";
  const customName = asString(read(snapshot, index, "name")).trim();
  const flags = [
    ["baby", "ребёнок"],
    ["boss", "босс"],
    ["invul", "неуязвимый"],
    ["invisible", "невидимый"],
    ["noai", "без ИИ"],
    ["glow", "светится"],
    ["nogravity", "без гравитации"],
    ["silent", "бесшумный"],
    ["persist", "не исчезает"],
  ].filter(([field]) => asBool(read(snapshot, index, field))).map(([, label]) => label);
  const stats = [
    ["HP", "health"],
    ["Скорость", "speed"],
    ["Броня", "armor"],
    ["Урон", "attack"],
    ["Отбрасывание", "kb"],
    ["Масштаб", "scale"],
  ].map(([label, field]) => [label, asString(read(snapshot, index, field))] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  const gear = SLOTS.flatMap((slot) => {
    const itemId = asString(read(snapshot, index, `slot-${slot.key}`));
    if (!itemId) return [];
    const count = Number.parseInt(asString(read(snapshot, index, `count-${slot.key}`)), 10) || 1;
    const extras: string[] = [];
    if (count > 1) extras.push(`${count} шт.`);
    if (itemId.startsWith("leather_") && asBool(read(snapshot, index, `dyeon-${slot.key}`))) extras.push("окрашено");
    if (canHaveTrim(itemId) && asBool(read(snapshot, index, `trimon-${slot.key}`))) extras.push("отделка");
    if (supportsBannerPatterns(itemId) && asBool(read(snapshot, index, `shieldon-${slot.key}`))) {
      const layerCount = Array.from({ length: 16 }, (_, layerIndex) => read(snapshot, index, `shieldpat-${slot.key}-${layerIndex}`)).filter(hasValue).length;
      extras.push(layerCount ? `узоры: ${layerCount}` : itemId === "shield" ? "цвет щита" : "цвет флага");
    }
    const enchants = enchantSelections(snapshot, index, slot.key).map(({ id, lvl }) => {
      const known = enchantsForItem(itemId).find((enchant) => enchant.id === id);
      return `${known ? known.name : id} ${lvl}`;
    });
    if (enchants.length) extras.push(enchants.join(", "));
    return [{ slot: slot.label, item: ITEM_NAMES[itemId as keyof typeof ITEM_NAMES] || itemId, extras }];
  });

  const effects = EFFECTS.flatMap(([id, name]) => {
    if (!asBool(read(snapshot, index, `eff-${id}`))) return [];
    const amp = Number.parseInt(asString(read(snapshot, index, `effamp-${id}`)), 10) || 0;
    const dur = Number.parseInt(asString(read(snapshot, index, `effdur-${id}`)), 10) || 999999;
    return [`${name} ${amp + 1} (${dur >= 999999 ? "очень долго" : `${Math.round(dur / 20)} сек.`})`];
  });

  return { mobType, customName, flags, stats, gear, effects };
}

export function toSnapshot(mobTypes: string[]): SummonSnapshot {
  const fields: Record<string, SummonFieldValue> = {};
  mobTypes.forEach((mobType, index) => {
    fields[`${index}-mob`] = mobType;
    fields[`${index}-persist`] = true;
    fields[`${index}-name-visible`] = true;
  });
  return { mobOrder: mobTypes.map((mobType) => ({ mobType })), fields };
}

export function normalizeSnapshot(snapshot: SummonSnapshot): SummonSnapshot {
  if (!snapshot.mobOrder.length) return toSnapshot(["zombie"]);
  const fields = { ...snapshot.fields };
  snapshot.mobOrder.forEach((mob, index) => {
    fields[`${index}-mob`] = asString(fields[`${index}-mob`]) || mob.mobType || "zombie";
  });
  return { mobOrder: snapshot.mobOrder.map((mob, index) => ({ mobType: asString(fields[`${index}-mob`]) || mob.mobType || "zombie" })), fields };
}
