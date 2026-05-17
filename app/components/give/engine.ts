import {
  ALL_ITEMS,
  BANNER_PATTERNS,
  canHaveTrim,
  DYE_COLORS,
  EFFECTS,
  ENCHANTS,
  FOOD_ITEMS,
  POTIONS,
  TRIM_MATERIALS,
  TRIM_PATTERNS,
} from "./data";

export type GiveFieldValue = string | boolean | number;

export type Explosion = {
  id: number;
  shape: string;
  colors: string[];
  fadeColors: string[];
  trail: boolean;
  twinkle: boolean;
};

export type ShieldLayer = {
  id: number;
  pattern: string;
  color: string;
};

export type GiveSnapshot = {
  itemId: string;
  target: string;
  targetCustom: string;
  count: string;
  fields: Record<string, GiveFieldValue>;
  explosions: Explosion[];
  shieldLayers: ShieldLayer[];
  potionType: string;
  potionModifier: string;
};

export function defaultGiveSnapshot(): GiveSnapshot {
  return {
    itemId: "wooden_sword",
    target: "@s",
    targetCustom: "",
    count: "1",
    fields: {
      "name-color": "",
      "dye-color": "#a06540",
      "trim-mat": "quartz",
      "trim-pat": "sentry",
      "shield-base": "white",
      "food-nutrition": "4",
      "food-saturation": "0.6",
      "fw-duration": "1",
      "totem-eff-on-0": true,
      "totem-eff-0": "regeneration",
      "totem-eff-amp-0": "1",
      "totem-eff-dur-0": "900",
      "totem-eff-on-1": true,
      "totem-eff-1": "absorption",
      "totem-eff-amp-1": "1",
      "totem-eff-dur-1": "100",
      "totem-eff-on-2": true,
      "totem-eff-2": "fire_resistance",
      "totem-eff-amp-2": "0",
      "totem-eff-dur-2": "800",
    },
    explosions: [],
    shieldLayers: [{ id: 0, pattern: "stripe_center", color: "black" }],
    potionType: "potion",
    potionModifier: "normal",
  };
}

export function isPotion(id: string) {
  return id.startsWith("potion:");
}

export function potionOptions(itemId: string) {
  const effect = itemId.split(":")[1];
  const entry = POTIONS.find((p) => p[0] === effect);
  return { hasLong: Boolean(entry?.[2]), hasStrong: Boolean(entry?.[3]) };
}

function stringValue(snapshot: GiveSnapshot, field: string, fallback = "") {
  const value = snapshot.fields[field];
  return value === undefined || value === null ? fallback : String(value);
}

function boolValue(snapshot: GiveSnapshot, field: string) {
  return snapshot.fields[field] === true || snapshot.fields[field] === "true";
}

function numberValue(snapshot: GiveSnapshot, field: string, fallback: number) {
  const value = Number.parseFloat(stringValue(snapshot, field));
  return Number.isFinite(value) ? value : fallback;
}

const enchantNames = new Map<string, string>(Object.values(ENCHANTS).flat().map((enchant) => [enchant.id, enchant.name]));
const effectNames = new Map<string, string>(EFFECTS.map(([id, name]) => [id, name]));
const potionNames = new Map<string, string>(POTIONS.map(([id, name]) => [id, name]));
const trimMaterialNames = new Map<string, string>(TRIM_MATERIALS.map(([id, name]) => [id, name]));
const trimPatternNames = new Map<string, string>(TRIM_PATTERNS.map(([id, name]) => [id, name]));
const dyeNames = new Map<string, string>(DYE_COLORS.map(([id, name]) => [id, name]));
const dyeHexes = new Map<string, string>(DYE_COLORS.map(([id, , hex]) => [id, hex]));
const bannerPatternNames = new Map<string, string>(BANNER_PATTERNS.map(([id, name]) => [id, name]));

function romanLevel(level: number) {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return romans[level - 1] || String(level);
}

function effectSummary(name: string, amp: number, duration: number, suffix = "") {
  return `${effectNames.get(name) || name} ${romanLevel(amp + 1)} на ${duration} тиков${suffix}`;
}

export function getGiveTarget(snapshot: GiveSnapshot) {
  return snapshot.targetCustom.trim() || snapshot.target || "@s";
}

function buildComponents(snapshot: GiveSnapshot) {
  const comps: string[] = [];
  const rawItemId = snapshot.itemId;

  if (isPotion(rawItemId)) {
    const base = rawItemId.split(":")[1];
    const mod = snapshot.potionModifier || "normal";
    const effectId = mod === "long" ? `long_${base}` : mod === "strong" ? `strong_${base}` : base;
    comps.push(`potion_contents={potion:"minecraft:${effectId}"}`);
  }

  const name = stringValue(snapshot, "name").trim();
  if (name) {
    const color = stringValue(snapshot, "name-color");
    const bold = boolValue(snapshot, "name-bold");
    const italic = boolValue(snapshot, "name-italic");
    if (!color && !bold && !italic) {
      comps.push(`custom_name='${name}'`);
    } else {
      const parts = [`text:"${name}"`];
      if (color) parts.push(`color:"${color}"`);
      if (bold) parts.push("bold:true");
      if (italic) parts.push("italic:true");
      comps.push(`custom_name={${parts.join(",")}}`);
    }
  }

  const loreLines: string[] = [];
  for (let i = 0; i < 5; i++) {
    const line = stringValue(snapshot, `lore-${i}`).trim();
    if (!line) continue;
    const loreColor = stringValue(snapshot, `lore-color-${i}`);
    loreLines.push(loreColor ? `{text:"${line}",color:"${loreColor}"}` : `'${line}'`);
  }
  if (loreLines.length) comps.push(`lore=[${loreLines.join(",")}]`);

  const enchantParts = Object.entries(snapshot.fields)
    .filter(([key, value]) => key.startsWith("ench-") && (value === true || value === "true"))
    .map(([key]) => {
      const enchId = key.slice("ench-".length);
      const level = Math.max(1, Number.parseInt(stringValue(snapshot, `enchlvl-${enchId}`, "1"), 10) || 1);
      return `${enchId}:${level}`;
    });
  if (enchantParts.length) comps.push(`enchantments={${enchantParts.join(",")}}`);

  if (rawItemId.startsWith("leather_") && boolValue(snapshot, "dye-on")) {
    const hex = stringValue(snapshot, "dye-color", "#a06540").replace("#", "");
    comps.push(`dyed_color=${Number.parseInt(hex, 16)}`);
  }

  if (canHaveTrim(rawItemId) && boolValue(snapshot, "trim-on")) {
    comps.push(`trim={material:"${stringValue(snapshot, "trim-mat", "iron")}",pattern:"${stringValue(snapshot, "trim-pat", "sentry")}"}`);
  }

  if (rawItemId === "shield" && boolValue(snapshot, "shield-on")) {
    comps.push(`base_color="${stringValue(snapshot, "shield-base", "white")}"`);
    if (snapshot.shieldLayers.length) {
      const patterns = snapshot.shieldLayers.map((layer) => `{pattern:"minecraft:${layer.pattern}",color:"${layer.color}"}`);
      comps.push(`banner_patterns=[${patterns.join(",")}]`);
    }
  }

  if (FOOD_ITEMS.has(rawItemId)) {
    const nutrition = Math.trunc(numberValue(snapshot, "food-nutrition", 0));
    const saturation = numberValue(snapshot, "food-saturation", 0);
    let foodStr = `food={nutrition:${nutrition},saturation:${saturation.toFixed(1)}f`;
    if (boolValue(snapshot, "food-always-eat")) foodStr += ",can_always_eat:true";
    comps.push(`${foodStr}}`);

    const effects: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (!boolValue(snapshot, `food-eff-on-${i}`)) continue;
      const eff = stringValue(snapshot, `food-eff-${i}`);
      if (!eff) continue;
      const amp = Math.trunc(numberValue(snapshot, `food-eff-amp-${i}`, 0));
      const dur = Math.trunc(numberValue(snapshot, `food-eff-dur-${i}`, 200));
      const prob = numberValue(snapshot, `food-eff-prob-${i}`, 1);
      effects.push(`{id:"minecraft:${eff}",duration:${dur},amplifier:${amp},probability:${prob.toFixed(2)}f}`);
    }
    if (effects.length) {
      comps.push(`consumable={consume_seconds:1.6f,animation:"eat",on_consume_effects:[{type:"minecraft:apply_effects",effects:[${effects.join(",")}]}]}`);
    }
  }

  if (boolValue(snapshot, "totem-on")) {
    const effects: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (!boolValue(snapshot, `totem-eff-on-${i}`)) continue;
      const eff = stringValue(snapshot, `totem-eff-${i}`);
      if (!eff) continue;
      const amp = Math.trunc(numberValue(snapshot, `totem-eff-amp-${i}`, 0));
      const dur = Math.trunc(numberValue(snapshot, `totem-eff-dur-${i}`, 200));
      effects.push(`{id:"minecraft:${eff}",duration:${dur},amplifier:${amp}}`);
    }
    const deathEffects = effects.length
      ? `[{type:"minecraft:apply_effects",effects:[${effects.join(",")}]},{type:"minecraft:play_sound",sound:{sound_id:"minecraft:item.totem.use"}}]`
      : `[{type:"minecraft:totem_of_undying"}]`;
    comps.push(`death_protection={death_effects:${deathEffects}}`);
  }

  if (rawItemId === "firework_rocket") {
    const duration = stringValue(snapshot, "fw-duration", "1");
    if (snapshot.explosions.length) {
      const explosions = snapshot.explosions.map((exp) => {
        const parts = [`shape:"${exp.shape}"`];
        if (exp.colors.length) parts.push(`colors:[I;${exp.colors.map((c) => Number.parseInt(c.replace("#", ""), 16)).join(",")}]`);
        if (exp.fadeColors.length) parts.push(`fade_colors:[I;${exp.fadeColors.map((c) => Number.parseInt(c.replace("#", ""), 16)).join(",")}]`);
        if (exp.trail) parts.push("has_trail:true");
        if (exp.twinkle) parts.push("has_twinkle:true");
        return `{${parts.join(",")}}`;
      });
      comps.push(`fireworks={flight_duration:${duration}b,explosions:[${explosions.join(",")}]}`);
    } else {
      comps.push(`fireworks={flight_duration:${duration}b}`);
    }
  }

  return comps;
}

export function buildGiveCommand(snapshot: GiveSnapshot) {
  const rawItemId = snapshot.itemId;
  if (!rawItemId) return "— выберите предмет —";
  const itemId = isPotion(rawItemId) ? snapshot.potionType || "potion" : rawItemId;
  const count = Math.max(1, Math.min(64, Number.parseInt(snapshot.count, 10) || 1));
  const compStr = buildComponents(snapshot);
  const components = compStr.length ? `[${compStr.join(",")}]` : "";
  const target = getGiveTarget(snapshot);
  const make = (nextTarget: string) => `/give ${nextTarget} minecraft:${itemId}${components} ${count}`;
  const command = make(target);
  return target === "@s" && command.length > 256 ? make("@p") : command;
}

export function getGivePreviewData(snapshot: GiveSnapshot) {
  const rawItemId = snapshot.itemId;
  const itemId = isPotion(rawItemId) ? snapshot.potionType || "potion" : rawItemId;
  const itemName = ALL_ITEMS[rawItemId] || ALL_ITEMS[itemId] || rawItemId || "Предмет";
  const customName = stringValue(snapshot, "name").trim();
  const count = Math.max(1, Math.min(64, Number.parseInt(snapshot.count, 10) || 1));
  const target = getGiveTarget(snapshot);
  const nameStyle = [
    stringValue(snapshot, "name-color") ? `цвет: ${stringValue(snapshot, "name-color")}` : "",
    boolValue(snapshot, "name-bold") ? "жирное" : "",
    boolValue(snapshot, "name-italic") ? "курсив" : "",
  ].filter(Boolean);

  const lore: string[] = [];
  for (let i = 0; i < 5; i++) {
    const line = stringValue(snapshot, `lore-${i}`).trim();
    if (!line) continue;
    const color = stringValue(snapshot, `lore-color-${i}`);
    lore.push(color ? `${line} (${color})` : line);
  }

  const enchantments = Object.entries(snapshot.fields)
    .filter(([key, value]) => key.startsWith("ench-") && (value === true || value === "true"))
    .map(([key]) => {
      const enchId = key.slice("ench-".length);
      const level = Math.max(1, Number.parseInt(stringValue(snapshot, `enchlvl-${enchId}`, "1"), 10) || 1);
      return `${enchantNames.get(enchId) || enchId} ${romanLevel(level)}`;
    });

  const chips = [`${count} шт.`, `цель: ${target}`];
  const sections: Array<{ label: string; value: string; swatches?: string[] }> = [];

  if (isPotion(rawItemId)) {
    const potionTypeName = {
      potion: "обычное",
      splash_potion: "бросаемое",
      lingering_potion: "длительное",
      tipped_arrow: "зачарованная стрела",
    }[snapshot.potionType || "potion"] || snapshot.potionType || "обычное";
    const modifier = snapshot.potionModifier === "long" ? "продлённое" : snapshot.potionModifier === "strong" ? "усиленное II" : "обычное";
    sections.push({ label: "Зелье", value: `${potionNames.get(rawItemId.split(":")[1]) || rawItemId.split(":")[1]} — ${potionTypeName}, ${modifier}` });
  }

  if (rawItemId.startsWith("leather_") && boolValue(snapshot, "dye-on")) {
    sections.push({ label: "Окраска", value: stringValue(snapshot, "dye-color", "#a06540"), swatches: [stringValue(snapshot, "dye-color", "#a06540")] });
  }

  if (canHaveTrim(rawItemId) && boolValue(snapshot, "trim-on")) {
    const material = stringValue(snapshot, "trim-mat", "quartz");
    const pattern = stringValue(snapshot, "trim-pat", "sentry");
    sections.push({ label: "Отделка", value: `${trimMaterialNames.get(material) || material}, узор ${trimPatternNames.get(pattern) || pattern}` });
  }

  if (rawItemId === "shield" && boolValue(snapshot, "shield-on")) {
    const base = stringValue(snapshot, "shield-base", "white");
    const layers = snapshot.shieldLayers.map((layer, index) => `${index + 1}. ${bannerPatternNames.get(layer.pattern) || layer.pattern} (${dyeNames.get(layer.color) || layer.color})`);
    sections.push({
      label: "Щит",
      value: `${dyeNames.get(base) || base}${layers.length ? `; ${layers.join("; ")}` : ""}`,
      swatches: [dyeHexes.get(base) || base, ...snapshot.shieldLayers.map((layer) => dyeHexes.get(layer.color) || layer.color)],
    });
  }

  if (FOOD_ITEMS.has(rawItemId)) {
    const nutrition = Math.trunc(numberValue(snapshot, "food-nutrition", 0));
    const saturation = numberValue(snapshot, "food-saturation", 0);
    const foodEffects: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (!boolValue(snapshot, `food-eff-on-${i}`)) continue;
      const eff = stringValue(snapshot, `food-eff-${i}`);
      if (!eff) continue;
      const amp = Math.trunc(numberValue(snapshot, `food-eff-amp-${i}`, 0));
      const dur = Math.trunc(numberValue(snapshot, `food-eff-dur-${i}`, 200));
      const prob = numberValue(snapshot, `food-eff-prob-${i}`, 1);
      foodEffects.push(effectSummary(eff, amp, dur, prob < 1 ? `, шанс ${Math.round(prob * 100)}%` : ""));
    }
    sections.push({ label: "Еда", value: `питательность ${nutrition}, насыщение ${saturation.toFixed(1)}${boolValue(snapshot, "food-always-eat") ? ", можно есть сытым" : ""}` });
    if (foodEffects.length) sections.push({ label: "После еды", value: foodEffects.join("; ") });
  }

  if (boolValue(snapshot, "totem-on")) {
    const totemEffects: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (!boolValue(snapshot, `totem-eff-on-${i}`)) continue;
      const eff = stringValue(snapshot, `totem-eff-${i}`);
      if (!eff) continue;
      const amp = Math.trunc(numberValue(snapshot, `totem-eff-amp-${i}`, 0));
      const dur = Math.trunc(numberValue(snapshot, `totem-eff-dur-${i}`, 200));
      totemEffects.push(effectSummary(eff, amp, dur));
    }
    sections.push({ label: "Тотем", value: totemEffects.length ? totemEffects.join("; ") : "срабатывает как тотем бессмертия" });
  }

  if (rawItemId === "firework_rocket") {
    const duration = stringValue(snapshot, "fw-duration", "1");
    const explosions = snapshot.explosions.map((exp, index) => {
      const flags = [exp.trail ? "след" : "", exp.twinkle ? "мерцание" : ""].filter(Boolean);
      return `взрыв ${index + 1}: ${exp.shape}${flags.length ? ` (${flags.join(", ")})` : ""}`;
    });
    sections.push({
      label: "Фейерверк",
      value: `полёт ${duration}${explosions.length ? `; ${explosions.join("; ")}` : ""}`,
      swatches: snapshot.explosions.flatMap((exp) => [...exp.colors, ...exp.fadeColors]).slice(0, 10),
    });
  }

  return {
    itemId,
    itemName,
    customName,
    nameStyle,
    lore,
    enchantments,
    chips,
    sections,
  };
}
