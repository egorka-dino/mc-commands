import {
  ALL_ITEMS,
  ALL_MOBS,
  BANNER_PATTERNS,
  COMMAND_LEVEL_MAX,
  DYE_COLORS,
  EFFECTS,
  enchantsForItem,
  GIVE_ITEM_GROUPS,
  MOB_GROUPS,
  POTIONS,
  SUMMON_EQUIPMENT_SLOTS,
  TRIM_MATERIALS,
  TRIM_PATTERNS,
  type EnchantInfo,
} from "../../../components/minecraft/data";
import { defaultGiveSnapshot, isPotion, potionOptions, type Explosion, type GiveFieldValue, type GiveSnapshot, type ShieldLayer } from "../../../components/give/engine";
import { normalizeSnapshot, toSnapshot } from "../../../components/summon/engine";
import type { SummonFieldValue, SummonSnapshot } from "../../../components/summon/data";

export const dynamic = "force-dynamic";

type Mode = "summon" | "give";
type Primitive = string | number | boolean;
type AiOperation = {
  action: string;
  index?: number;
  field?: string;
  slot?: string;
  itemId?: string;
  mobType?: string;
  enchantId?: string;
  effectId?: string;
  value?: Primitive;
  count?: number;
  level?: number;
  durationSeconds?: number;
  dropChance?: number;
  material?: string;
  pattern?: string;
  color?: string;
  target?: string;
  potionType?: string;
  potionModifier?: string;
  shape?: string;
  colors?: string[];
  fadeColors?: string[];
  trail?: boolean;
  twinkle?: boolean;
};
type AiPlan = {
  summary: string;
  operations: AiOperation[];
  notes: string[];
};
type PromptCacheRetention = "in_memory" | "24h";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const PROMPT_CACHE_KEY_PREFIX = "mc-commands-ai-command";
const maxMobs = 6;
const validMobs = new Set(Object.keys(ALL_MOBS));
const validGiveItems = new Set<string>(Object.keys(ALL_ITEMS));
const validSummonItems = new Set<string>(SUMMON_EQUIPMENT_SLOTS.flatMap((slot) => [...slot.items]));
const validEffects = new Set<string>(EFFECTS.map(([id]) => id));
const validSlots = new Set<string>(SUMMON_EQUIPMENT_SLOTS.map((slot) => slot.key));
const validColors = new Set<string>(DYE_COLORS.map(([id]) => id));
const validTrimMaterials = new Set<string>(TRIM_MATERIALS.map(([id]) => id));
const validTrimPatterns = new Set<string>(TRIM_PATTERNS.map(([id]) => id));
const validBannerPatterns = new Set<string>(BANNER_PATTERNS.map(([id]) => id));
const validPotionEffects = new Set<string>(POTIONS.map(([id]) => id));
const validPotionTypes = new Set(["potion", "splash_potion", "lingering_potion", "tipped_arrow"]);
const validPotionModifiers = new Set(["normal", "long", "strong"]);
const validGiveTargets = new Set(["@s", "@p", "@a", "@r"]);
const summonBooleanFields = new Set(["baby", "invul", "invisible", "silent", "noai", "noburn", "onfire", "glow", "nogravity", "persist", "nobreath", "boss", "name-bold", "name-italic", "name-visible"]);
const summonTextFields = new Set(["name", "name-color"]);
const summonNumberFields = new Set(["health", "speed", "armor", "attack", "kb", "scale", "power-x", "power-y", "power-z", "explosion-power"]);
const giveBooleanFields = new Set(["name-bold", "name-italic", "dye-on", "trim-on", "shield-on", "food-always-eat", "totem-on"]);
const giveTextFields = new Set(["name", "name-color", "dye-color", "trim-mat", "trim-pat", "shield-base", "food-nutrition", "food-saturation", "fw-duration"]);
const nameColors = new Set(["", "white", "gray", "dark_gray", "black", "red", "dark_red", "gold", "yellow", "green", "dark_green", "aqua", "dark_aqua", "blue", "dark_blue", "light_purple", "dark_purple"]);

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["operations"],
  properties: {
    summary: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
    operations: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action"],
        properties: {
          action: { type: "string" },
          index: { type: "integer" },
          field: { type: "string" },
          slot: { type: "string" },
          itemId: { type: "string" },
          mobType: { type: "string" },
          enchantId: { type: "string" },
          effectId: { type: "string" },
          value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
          count: { type: "integer" },
          level: { type: "integer" },
          durationSeconds: { type: "integer" },
          dropChance: { type: "number" },
          material: { type: "string" },
          pattern: { type: "string" },
          color: { type: "string" },
          target: { type: "string" },
          potionType: { type: "string" },
          potionModifier: { type: "string" },
          shape: { type: "string" },
          colors: { type: "array", items: { type: "string" } },
          fadeColors: { type: "array", items: { type: "string" } },
          trail: { type: "boolean" },
          twinkle: { type: "boolean" },
        },
      },
    },
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY не настроен на сервере." }, { status: 503 });

  let body: { mode?: Mode; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON запроса." }, { status: 400 });
  }

  const mode = body.mode;
  const prompt = body.prompt?.trim() || "";
  if (mode !== "summon" && mode !== "give") return Response.json({ error: "Неизвестный режим генератора." }, { status: 400 });
  if (prompt.length < 3) return Response.json({ error: "Опиши, что нужно собрать." }, { status: 400 });
  if (prompt.length > 1500) return Response.json({ error: "Описание слишком длинное. Сократи его до 1500 символов." }, { status: 400 });

  try {
    const plan = await requestAiPlan(apiKey, mode, prompt);
    const result = mode === "summon" ? applySummonPlan(plan) : applyGivePlan(plan, prompt);
    return Response.json({ ...result, summary: plan.summary, notes: plan.notes.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не получилось обработать описание." }, { status: 502 });
  }
}

async function requestAiPlan(apiKey: string, mode: Mode, prompt: string): Promise<AiPlan> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(35000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      max_output_tokens: 1400,
      prompt_cache_key: `${PROMPT_CACHE_KEY_PREFIX}-${mode}`,
      ...promptCacheRetentionOptions(),
      input: [
        { role: "system", content: buildSystemPrompt(mode) },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "minecraft_command_plan",
          strict: false,
          schema: responseSchema,
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = typeof json?.error?.message === "string" ? json.error.message : "AI-помощник не вернул успешный ответ.";
    throw new Error(message);
  }

  const text = extractOutputText(json);
  if (!text) throw new Error("AI-помощник вернул пустой ответ.");
  return coercePlan(JSON.parse(text));
}

function promptCacheRetentionOptions(): { prompt_cache_retention?: PromptCacheRetention } {
  const retention = process.env.OPENAI_PROMPT_CACHE_RETENTION;
  if (retention === "in_memory" || retention === "24h") return { prompt_cache_retention: retention };
  return {};
}

function buildSystemPrompt(mode: Mode) {
  const common = [
    "Ты помощник русскоязычного генератора команд Minecraft Java Edition 1.21.5+.",
    "Верни только JSON по схеме. Не генерируй готовую команду.",
    "Пиши компактный JSON: в operation добавляй только поля, нужные для её action; не пиши null и пустые поля. summary и notes нужны только если есть полезное короткое пояснение.",
    "Используй только перечисленные ID. Если пользователь просит невозможное или неясное, выбери ближайший допустимый вариант и добавь короткую заметку.",
    "Каждую явно названную настройку нужно отразить отдельной operation. Если пользователь просит два зачарования, верни две операции зачарования.",
    `Уровни зачарований можно указывать от 1 до ${COMMAND_LEVEL_MAX}; максимум в списке чар — обычный ванильный уровень, а не жёсткий предел команды.`,
    "Уровни эффектов в UI: I = amplifier 0, V = amplifier 4. В операции set_effect указывай level как человеческий уровень, сервер сам переведёт.",
    "Синонимы: незерит/незеритка/незеритовка/назаритка = netherite; усталость/усталость копания = mining_fatigue; сила = strength; скорость = speed.",
    "Синонимы чар: острота = sharpness; добыча на мече = looting; удача на инструментах = fortune; неразрушимость = unbreaking; починка = mending. В фактах этого сайта Добыча/looting на мечах допустима, обязательно добавляй её отдельной operation, если пользователь просит. Фраза 'с названием/имени' означает set_text field=name.",
  ];
  if (mode === "summon") {
    return [
      ...common,
      "Режим summon. Нужно заполнить редактор мобов и пассажиров.",
      "Операции summon: set_mob(index,mobType), set_text(index,field,value), set_boolean(index,field,value), set_number(index,field,value), set_equipment(index,slot,itemId,count,dropChance), set_equipment_enchant(index,slot,enchantId,level), set_equipment_trim(index,slot,material,pattern), set_equipment_dye(index,slot,color), set_effect(index,effectId,level,durationSeconds).",
      "index 0 — основной нижний моб. index 1 сидит на index 0, index 2 сидит на index 1. Для пассажиров сначала делай set_mob с нужным index.",
      "dropChance заполняй только если пользователь явно просит шанс выпадения; иначе null.",
      "Если просят 'в незеритке', поставь полный netherite armor: head/chest/legs/feet. Оружие клади в mainhand, щит/тотем в offhand.",
      `Мобы: ${formatGrouped(MOB_GROUPS, "mobs")}.`,
      `Слоты summon: ${SUMMON_EQUIPMENT_SLOTS.map((slot) => `${slot.key}=[${slot.items.join(", ")}]`).join("; ")}.`,
      `Эффекты: ${EFFECTS.map(([id, name]) => `${id}=${name}`).join(", ")}.`,
      `Зачарования по предметам выбирай из фактов: ${formatEnchantFacts([...validSummonItems])}.`,
      `Цвета имён: ${[...nameColors].filter(Boolean).join(", ")}. Цвет кожи: hex #rrggbb. Отделки: materials ${TRIM_MATERIALS.map(([id]) => id).join(", ")}; patterns ${TRIM_PATTERNS.map(([id]) => id).join(", ")}.`,
    ].join("\n");
  }
  return [
    ...common,
    "Режим give. Нужно заполнить редактор выдачи предмета.",
    "Операции give: set_item(itemId), set_count(count), set_target(target), set_text(field,value), set_boolean(field,value), set_enchant(enchantId,level), set_trim(material,pattern), set_dye(color), set_shield(color,pattern), set_potion(potionType,potionModifier), set_food_effect(index,effectId,level,durationSeconds), set_totem_effect(index,effectId,level,durationSeconds), set_firework(shape,colors,fadeColors,trail,twinkle).",
    "Для зелий itemId имеет формат potion:effect, а potionType выбирает предмет: potion/splash_potion/lingering_potion/tipped_arrow.",
    `Предметы: ${formatGrouped(GIVE_ITEM_GROUPS, "items")}.`,
    `Эффекты: ${EFFECTS.map(([id, name]) => `${id}=${name}`).join(", ")}.`,
    `Зелья: ${POTIONS.map(([id, name, long, strong]) => `${id}=${name}${long ? ",long" : ""}${strong ? ",strong" : ""}`).join("; ")}.`,
    `Зачарования по предметам: ${formatEnchantFacts([...validGiveItems])}.`,
    `Цвета имён: ${[...nameColors].filter(Boolean).join(", ")}. Красители: ${DYE_COLORS.map(([id]) => id).join(", ")}. Отделки: materials ${TRIM_MATERIALS.map(([id]) => id).join(", ")}; patterns ${TRIM_PATTERNS.map(([id]) => id).join(", ")}. Узоры щита: ${BANNER_PATTERNS.map(([id]) => id).join(", ")}.`,
  ].join("\n");
}

function formatGrouped(groups: readonly { name: string; mobs?: readonly unknown[]; items?: readonly unknown[] }[], key: "mobs" | "items") {
  return groups.map((group) => {
    const pairs = (group[key] || []).filter((item): item is readonly [string, string] => Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string");
    return `${group.name}: ${pairs.map(([id, name]) => `${id}=${name}`).join(", ")}`;
  }).join("; ");
}

function formatEnchantFacts(itemIds: string[]) {
  return itemIds
    .map((itemId) => {
      const enchants = enchantsForItem(itemId);
      return enchants.length ? `${itemId}:[${enchants.map((enchant) => `${enchant.id}:обычно${enchant.max}`).join(",")}]` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function extractOutputText(json: unknown) {
  if (typeof json !== "object" || json === null) return "";
  const direct = (json as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => {
      if (typeof part !== "object" || part === null) return [];
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? [text] : [];
    });
  }).join("");
}

function coercePlan(value: unknown): AiPlan {
  if (typeof value !== "object" || value === null) throw new Error("AI-помощник вернул не JSON-объект.");
  const plan = value as Partial<AiPlan>;
  return {
    summary: typeof plan.summary === "string" ? plan.summary.slice(0, 240) : "Готово",
    operations: Array.isArray(plan.operations) ? plan.operations.filter((op): op is AiOperation => typeof op === "object" && op !== null && typeof (op as AiOperation).action === "string") : [],
    notes: Array.isArray(plan.notes) ? plan.notes.filter((note): note is string => typeof note === "string").map((note) => note.slice(0, 240)) : [],
  };
}

function applySummonPlan(plan: AiPlan): { snapshot: SummonSnapshot } {
  let snapshot = toSnapshot(["zombie"]);
  for (const op of plan.operations) {
    const index = clampInt(op.index ?? 0, 0, maxMobs - 1);
    if (op.action === "set_mob" && op.mobType && validMobs.has(op.mobType)) {
      snapshot = ensureSummonIndex(snapshot, index, op.mobType);
      snapshot = setSummonField(snapshot, index, "mob", op.mobType);
      continue;
    }
    snapshot = ensureSummonIndex(snapshot, index);
    if (op.action === "set_text" && op.field && summonTextFields.has(op.field) && op.value !== undefined && op.value !== null) {
      const value = String(op.value).slice(0, 80);
      if (op.field === "name-color" && !nameColors.has(value)) continue;
      snapshot = setSummonField(snapshot, index, op.field, value);
    } else if (op.action === "set_boolean" && op.field && summonBooleanFields.has(op.field)) {
      snapshot = setSummonField(snapshot, index, op.field, Boolean(op.value));
    } else if (op.action === "set_number" && op.field && summonNumberFields.has(op.field) && op.value !== undefined && op.value !== null) {
      snapshot = setSummonField(snapshot, index, op.field, cleanNumber(op.value, -1000000, 1000000));
    } else if (op.action === "set_equipment" && op.slot && op.itemId && validSlots.has(op.slot) && validSummonItems.has(op.itemId)) {
      if (!slotAllowsItem(op.slot, op.itemId)) continue;
      snapshot = setSummonField(snapshot, index, `slot-${op.slot}`, op.itemId);
      snapshot = setSummonField(snapshot, index, `count-${op.slot}`, String(clampInt(op.count ?? 1, 1, 99)));
      if (typeof op.dropChance === "number") snapshot = setSummonField(snapshot, index, `drop-${op.slot}`, String(clampNumber(op.dropChance, 0, 1)));
    } else if (op.action === "set_equipment_enchant" && op.slot && op.enchantId && validSlots.has(op.slot)) {
      const itemId = String(snapshot.fields[`${index}-slot-${op.slot}`] || "");
      const enchantId = normalizeEnchantId(itemId, op.enchantId);
      if (!enchantId) continue;
      snapshot = setSummonField(snapshot, index, `ench-${op.slot}-${enchantId}`, true);
      snapshot = setSummonField(snapshot, index, `enchlvl-${op.slot}-${enchantId}`, String(clampInt(op.level ?? 1, 1, COMMAND_LEVEL_MAX)));
    } else if (op.action === "set_equipment_trim" && op.slot && validSlots.has(op.slot) && validTrimMaterials.has(op.material || "") && validTrimPatterns.has(op.pattern || "")) {
      snapshot = setSummonField(snapshot, index, `trimon-${op.slot}`, true);
      snapshot = setSummonField(snapshot, index, `trimmat-${op.slot}`, op.material || "iron");
      snapshot = setSummonField(snapshot, index, `trimpat-${op.slot}`, op.pattern || "sentry");
    } else if (op.action === "set_equipment_dye" && op.slot && validSlots.has(op.slot) && isHexColor(op.color)) {
      snapshot = setSummonField(snapshot, index, `dyeon-${op.slot}`, true);
      snapshot = setSummonField(snapshot, index, `dye-${op.slot}`, op.color || "#a06540");
    } else if (op.action === "set_effect" && op.effectId && validEffects.has(op.effectId)) {
      snapshot = setSummonField(snapshot, index, `eff-${op.effectId}`, true);
      snapshot = setSummonField(snapshot, index, `effamp-${op.effectId}`, String(clampInt((op.level ?? 1) - 1, 0, 255)));
      snapshot = setSummonField(snapshot, index, `effdur-${op.effectId}`, String(clampInt((op.durationSeconds ?? 999999) * 20, 1, 1000000)));
    }
  }
  return { snapshot: normalizeSnapshot(snapshot) };
}

function applyGivePlan(plan: AiPlan, prompt: string): { snapshot: GiveSnapshot } {
  const snapshot = defaultGiveSnapshot();
  for (const op of plan.operations) {
    if (op.action === "set_item" && op.itemId && validGiveItems.has(op.itemId)) {
      snapshot.itemId = op.itemId;
      if (isPotion(op.itemId)) snapshot.potionType = "potion";
    } else if (op.action === "set_count") {
      snapshot.count = String(clampInt(op.count ?? numberFromValue(op.value, 1), 1, 64));
    } else if (op.action === "set_target" && op.target) {
      if (validGiveTargets.has(op.target)) snapshot.target = op.target;
      else if (op.target.startsWith("@")) snapshot.targetCustom = op.target.slice(0, 120);
    } else if (op.action === "set_text" && op.field && giveTextFields.has(op.field) && op.value !== undefined && op.value !== null) {
      const value = String(op.value).slice(0, 120);
      if (op.field === "name-color" && !nameColors.has(value)) continue;
      if (op.field === "dye-color" && !isHexColor(value)) continue;
      if (op.field === "trim-mat" && !validTrimMaterials.has(value)) continue;
      if (op.field === "trim-pat" && !validTrimPatterns.has(value)) continue;
      if (op.field === "shield-base" && !validColors.has(value)) continue;
      snapshot.fields[op.field] = value;
    } else if (op.action === "set_boolean" && op.field && giveBooleanFields.has(op.field)) {
      snapshot.fields[op.field] = Boolean(op.value);
    } else if ((op.action === "set_enchant" || op.action === "set_equipment_enchant") && op.enchantId) {
      const enchantId = normalizeEnchantId(snapshot.itemId, op.enchantId);
      if (!enchantId) continue;
      snapshot.fields[`ench-${enchantId}`] = true;
      snapshot.fields[`enchlvl-${enchantId}`] = String(clampInt(op.level ?? 1, 1, COMMAND_LEVEL_MAX));
    } else if (op.action === "set_trim" && validTrimMaterials.has(op.material || "") && validTrimPatterns.has(op.pattern || "")) {
      snapshot.fields["trim-on"] = true;
      snapshot.fields["trim-mat"] = op.material || "iron";
      snapshot.fields["trim-pat"] = op.pattern || "sentry";
    } else if (op.action === "set_dye" && isHexColor(op.color)) {
      snapshot.fields["dye-on"] = true;
      snapshot.fields["dye-color"] = op.color || "#a06540";
    } else if (op.action === "set_shield") {
      snapshot.fields["shield-on"] = true;
      if (validColors.has(op.color || "")) snapshot.fields["shield-base"] = op.color || "white";
      if (validBannerPatterns.has(op.pattern || "")) snapshot.shieldLayers = [freshShieldLayer(op.pattern || "stripe_center", "black")];
    } else if (op.action === "set_potion") {
      applyPotion(snapshot, op);
    } else if (op.action === "set_food_effect" && op.effectId && validEffects.has(op.effectId)) {
      setGiveEffect(snapshot.fields, "food", clampInt(op.index ?? 0, 0, 4), op.effectId, op.level, op.durationSeconds);
    } else if (op.action === "set_totem_effect" && op.effectId && validEffects.has(op.effectId)) {
      snapshot.fields["totem-on"] = true;
      setGiveEffect(snapshot.fields, "totem", clampInt(op.index ?? 0, 0, 2), op.effectId, op.level, op.durationSeconds);
    } else if (op.action === "set_firework") {
      snapshot.itemId = "firework_rocket";
      snapshot.explosions = [freshExplosion(op)];
    }
  }
  applyGivePromptFallbacks(snapshot, prompt);
  return { snapshot };
}

function ensureSummonIndex(snapshot: SummonSnapshot, index: number, mobType = "zombie") {
  if (snapshot.mobOrder[index]) return snapshot;
  const fields = { ...snapshot.fields };
  const mobOrder = [...snapshot.mobOrder];
  while (mobOrder.length <= index) {
    const nextIndex = mobOrder.length;
    mobOrder.push({ mobType });
    fields[`${nextIndex}-mob`] = mobType;
    fields[`${nextIndex}-persist`] = true;
    fields[`${nextIndex}-name-visible`] = true;
  }
  return normalizeSnapshot({ mobOrder, fields });
}

function setSummonField(snapshot: SummonSnapshot, index: number, field: string, value: SummonFieldValue) {
  const fields = { ...snapshot.fields, [`${index}-${field}`]: value };
  const mobOrder = snapshot.mobOrder.map((mob, mobIndex) => mobIndex === index && field === "mob" ? { mobType: String(value || "zombie") } : mob);
  return normalizeSnapshot({ mobOrder, fields });
}

function slotAllowsItem(slotKey: string, itemId: string) {
  return SUMMON_EQUIPMENT_SLOTS.some((slot) => slot.key === slotKey && (slot.items as readonly string[]).includes(itemId));
}

function enchantAllowed(itemId: string, enchantId: string) {
  return enchantsForItem(itemId).some((enchant: EnchantInfo) => enchant.id === enchantId);
}

function normalizeEnchantId(itemId: string, enchantId: string) {
  const aliases: Record<string, string[]> = {
    looting: ["looting", "loot_bonus_mobs", "dobycha", "добыча"],
    fortune: ["fortune", "loot_bonus_blocks", "luck"],
  };
  if (enchantAllowed(itemId, enchantId)) return enchantId;
  for (const [canonical, options] of Object.entries(aliases)) {
    if (options.includes(enchantId) && enchantAllowed(itemId, canonical)) return canonical;
  }
  return "";
}

function cleanNumber(value: Primitive, min: number, max: number) {
  return String(clampNumber(numberFromValue(value, 0), min, max));
}

function numberFromValue(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : fallback;
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function applyPotion(snapshot: GiveSnapshot, op: AiOperation) {
  if (op.effectId && validPotionEffects.has(op.effectId)) snapshot.itemId = `potion:${op.effectId}`;
  if (op.potionType && validPotionTypes.has(op.potionType)) snapshot.potionType = op.potionType;
  if (op.potionModifier && validPotionModifiers.has(op.potionModifier)) {
    const options = potionOptions(snapshot.itemId);
    snapshot.potionModifier = op.potionModifier === "long" && !options.hasLong ? "normal" : op.potionModifier === "strong" && !options.hasStrong ? "normal" : op.potionModifier;
  }
}

function setGiveEffect(fields: Record<string, GiveFieldValue>, kind: "food" | "totem", index: number, effectId: string, level = 1, durationSeconds = 10) {
  const prefix = kind === "food" ? "food-eff" : "totem-eff";
  fields[`${prefix}-on-${index}`] = true;
  fields[`${prefix}-${index}`] = effectId;
  fields[`${prefix}-amp-${index}`] = String(clampInt(level - 1, 0, 255));
  fields[`${prefix}-dur-${index}`] = String(clampInt(durationSeconds * 20, 1, 1000000));
  if (kind === "food") fields[`${prefix}-prob-${index}`] = "1.0";
}

function freshShieldLayer(pattern: string, color: string): ShieldLayer {
  return { id: Date.now() + Math.random(), pattern, color };
}

function freshExplosion(op: AiOperation): Explosion {
  return {
    id: Date.now() + Math.random(),
    shape: ["small_ball", "large_ball", "star", "creeper", "burst"].includes(op.shape || "") ? op.shape || "small_ball" : "small_ball",
    colors: (op.colors || ["#ff0000"]).filter(isHexColor).slice(0, 8),
    fadeColors: (op.fadeColors || []).filter(isHexColor).slice(0, 8),
    trail: Boolean(op.trail),
    twinkle: Boolean(op.twinkle),
  };
}

function applyGivePromptFallbacks(snapshot: GiveSnapshot, prompt: string) {
  const lower = prompt.toLowerCase();
  if ((snapshot.itemId.endsWith("_sword") || snapshot.itemId.endsWith("_axe")) && /добыч|looting/.test(lower) && !snapshot.fields["ench-looting"] && enchantAllowed(snapshot.itemId, "looting")) {
    snapshot.fields["ench-looting"] = true;
    snapshot.fields["enchlvl-looting"] = String(extractLevelAfter(lower, /(добыч\w*|looting)/) || 3);
  }
  if (/острот|sharpness/.test(lower) && !snapshot.fields["ench-sharpness"] && enchantAllowed(snapshot.itemId, "sharpness")) {
    snapshot.fields["ench-sharpness"] = true;
    snapshot.fields["enchlvl-sharpness"] = String(extractLevelAfter(lower, /(острот\w*|sharpness)/) || 5);
  }
}

function extractLevelAfter(text: string, marker: RegExp) {
  const match = marker.exec(text);
  if (!match) return 0;
  const tail = text.slice(match.index, match.index + 32);
  const roman = tail.match(/\b(i|ii|iii|iv|v)\b/i)?.[1]?.toUpperCase();
  if (roman) return { I: 1, II: 2, III: 3, IV: 4, V: 5 }[roman as "I" | "II" | "III" | "IV" | "V"];
  return clampInt(Number.parseInt(tail.match(/\d+/)?.[0] || "0", 10), 0, COMMAND_LEVEL_MAX);
}
