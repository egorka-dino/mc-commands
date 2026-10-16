import { commandAiHistory, parseGiveAiSnapshot } from "../../../server/command-ai-context";
import {
  ALL_ITEMS,
  ALL_MOBS,
  BANNER_PATTERNS,
  COMMAND_LEVEL_MAX,
  canHaveTrim,
  supportsBannerPatterns,
  FOOD_ITEMS,
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
import { defaultGiveSnapshot, isPotion, potionOptions, type Explosion, type GiveFieldValue, type GiveSnapshot } from "../../../components/give/engine";
import { normalizeSnapshot, toSnapshot } from "../../../components/summon/engine";
import type { SummonFieldValue, SummonSnapshot } from "../../../components/summon/data";

export const dynamic = "force-dynamic";

type Mode = "summon" | "give";
type Primitive = string | number | boolean;
type AiOperation = {
  action: string;
  index?: number;
  toIndex?: number;
  layerIndex?: number;
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
          toIndex: { type: "integer" },
          layerIndex: { type: "integer" },
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

  let body: { mode?: Mode; prompt?: unknown; snapshot?: unknown; history?: unknown };
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return Response.json({ error: "Некорректный JSON запроса." }, { status: 400 });
  }

  const mode = body.mode;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (mode !== "summon" && mode !== "give") return Response.json({ error: "Неизвестный режим генератора." }, { status: 400 });
  if (prompt.length < 3) return Response.json({ error: "Опиши, что нужно собрать." }, { status: 400 });
  if (prompt.length > 1500) return Response.json({ error: "Описание слишком длинное. Сократи его до 1500 символов." }, { status: 400 });

  let current: SummonSnapshot | undefined;
  let currentGive: GiveSnapshot | undefined;
  const history = commandAiHistory(body.history);
  if (mode === "summon") {
    if (body.snapshot !== undefined) {
      const raw = body.snapshot as SummonSnapshot;
      if (!raw || !Array.isArray(raw.mobOrder) || !raw.mobOrder.length || raw.mobOrder.length > maxMobs ||
          raw.mobOrder.some(mob => !mob || !validMobs.has(mob.mobType)) ||
          !raw.fields || typeof raw.fields !== "object" || Array.isArray(raw.fields) ||
          Object.keys(raw.fields).length > 10000 ||
          Object.entries(raw.fields).some(([key, value]) => !/^[0-5]-[a-z0-9_-]+$/.test(key) ||
            !(value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= 1000)))) {
        return Response.json({ error: "Некорректное состояние моба." }, { status: 400 });
      }
      current = normalizeSnapshot(raw);
      if (current.mobOrder.some(mob => !validMobs.has(mob.mobType))) return Response.json({ error: "Неизвестный моб." }, { status: 400 });
    }
  } else if (body.snapshot !== undefined) {
    const parsed = parseGiveAiSnapshot(body.snapshot);
    if (!parsed) return Response.json({ error: "Некорректное состояние предмета." }, { status: 400 });
    currentGive = parsed;
  }

  try {
    const plan = await requestAiPlan(apiKey, mode, prompt, current || currentGive, history);
    const result = mode === "summon" ? applySummonPlan(plan, current) : applyGivePlan(plan, prompt, currentGive);
    return Response.json({ ...result, summary: plan.summary, notes: plan.notes.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не получилось обработать описание." }, { status: 502 });
  }
}

async function requestAiPlan(apiKey: string, mode: Mode, prompt: string, current?: SummonSnapshot | GiveSnapshot, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<AiPlan> {
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
        ...history,
        { role: "user", content: current ? `Текущее состояние редактора (источник истины, включая ручные правки):\n${JSON.stringify(current)}\nНовый запрос: ${prompt}` : prompt },
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
    `Окраска кожаных предметов: color — hex #rrggbb или ID красителя (${DYE_COLORS.map(([id, name, hex]) => `${id}=${name}=${hex}`).join(", ")}). В summon используй set_equipment_dye(index,slot,color), в give — set_dye(color). Сначала выбери кожаный предмет. Окраска меняет цвет кожи, а не цвет имени и не отделку.`,
    "Синонимы: незерит/незеритка/незеритовка/назаритка = netherite; усталость/усталость копания = mining_fatigue; сила = strength; скорость = speed.",
    "Синонимы чар: острота = sharpness; добыча на мече = looting; удача на инструментах = fortune; неразрушимость = unbreaking; починка = mending. В фактах этого сайта Добыча/looting на мечах допустима, обязательно добавляй её отдельной operation, если пользователь просит. Фраза 'с названием/имени' означает set_text field=name.",
  ];
  if (mode === "summon") {
    return [
      ...common,
      "Режим summon. Нужно заполнить редактор мобов и пассажиров.",
      "Если передано текущее состояние, меняй только то, что просит НОВЫЙ запрос. Сохраняй остальные поля и пассажиров. История нужна для понимания ссылок, а текущее состояние важнее истории; не повторяй старые операции. Если состояния нет, собери с нуля.",
      "Удаление: remove_mob(index) удаляет ЛЮБОГО существующего моба, включая основного с index=0, если в цепочке больше одного моба. Следующие индексы сдвигаются вниз вместе со всеми настройками. При удалении index=0 прежний index=1 становится основным; остальные пассажиры сохраняются. Нескольких удаляй с конца. Единственного моба удалить нельзя: редактор должен содержать хотя бы одного моба, объясни это ограничение. НЕ заменяй удаление через set_mob, очистку снаряжения или копирование персонажей. clear_equipment(index,slot) удаляет предмет и все его настройки; remove_effect(index,effectId); remove_equipment_enchant(index,slot,enchantId). Для снятия флага set_boolean value=false, очистки имени set_text value=пустая строка, сброса числа reset_number(index,field). Снять окраску или отделку: clear_equipment_dye(index,slot), clear_equipment_trim(index,slot).",
      'Пример удаления: [паук, лошадь, зомби в алмазной броне, курица] + "Убери паука" → {"operations":[{"action":"remove_mob","index":0}]}, получится [та же лошадь, тот же зомби в броне, та же курица]. Если затем просят убрать лошадь, снова remove_mob(0): получится [тот же зомби в броне, та же курица]. Индексы бери из ТЕКУЩЕГО состояния, даже если история ошибочно утверждает, что моб уже удалён.',
      "Операции summon: remove_mob(index), mount_mob(index,mobType), insert_mob(index,mobType), move_mob(index,toIndex), set_mob(index,mobType), set_text(index,field,value), set_boolean(index,field,value), set_number(index,field,value), set_equipment(index,slot,itemId,count,dropChance), set_equipment_enchant(index,slot,enchantId,level), set_equipment_trim(index,slot,material,pattern), set_equipment_dye(index,slot,color), set_effect(index,effectId,level,durationSeconds).",
      "Щиты и флаги в снаряжении: set_equipment_shield(index,slot,color) меняет только основу; set_equipment_shield(index,slot,layerIndex,pattern,color) добавляет или меняет слой. index — моб, layerIndex — слот слоя 0..15 (отдельные индексы!). Для добавления выбери первый свободный слой. Для перекраски существующего слоя передай layerIndex и color без pattern. Сначала поставь shield или флаг через set_equipment. remove_equipment_shield_layer(index,slot,layerIndex) убирает только указанный слой; clear_equipment_shield_layers(index,slot) убирает все слои, сохраняя основу; clear_equipment_shield(index,slot) отключает оформление целиком.",
      'Пример красного щита с белым прямым крестом у основного моба: {"operations":[{"action":"set_equipment","index":0,"slot":"offhand","itemId":"shield"},{"action":"set_equipment_shield","index":0,"slot":"offhand","color":"red"},{"action":"set_equipment_shield","index":0,"slot":"offhand","layerIndex":0,"pattern":"straight_cross","color":"white"}]}. Основа — отдельная операция без layerIndex и pattern; для слоёв указывай layerIndex. pattern — ID без префикса minecraft:. Не пропускай основу, даже если добавляешь узоры.',
      `Красители для щитов и флагов: ${DYE_COLORS.map(([id, name]) => `${id}=${name}`).join(", ")}. Узоры: ${BANNER_PATTERNS.map(([id, name]) => `${id}=${name}`).join(", ")}.`,
      "index 0 — основной нижний моб. index 1 сидит на index 0, index 2 сидит на index 1. Для НОВОГО пассажира сверху делай set_mob с нужным index. Это НЕ посадка существующего персонажа на транспорт.",
      "Перестройка цепочки: insert_mob(index,mobType) вставляет НОВОГО моба на index (0..длина цепочки), сдвигая прежних вверх вместе со ВСЕМИ их настройками. move_mob(index,toIndex) перемещает СУЩЕСТВУЮЩЕГО моба целиком на конечный toIndex (0..длина-1), сдвигая остальных. После каждой операции индексы меняются; последующие операции адресуют уже новую цепочку. Максимум 6 мобов; если места нет, объясни ограничение, не удаляй персонажей без просьбы.",
      "ПОСАДКА: mount_mob(index,mobType) сажает СУЩЕСТВУЮЩЕГО персонажа index НА НОВОГО моба mobType. Сервер сам вставляет транспорт ПОД персонажем, сохраняя все поля персонажа и прежних пассажиров. Фраза Посади его на паука означает mount_mob(index персонажа,spider), а НЕ set_mob(index+1,spider): последнее посадит паука на персонажа и выполнит запрос наоборот. Правило одинаково для лошади, паука, свиньи и любого другого моба. Для посадки существующего персонажа на нового моба ВСЕГДА используй mount_mob, не set_mob и не insert_mob. Для перестановки существующих мобов используй move_mob. НЕ имитируй перенос через set_mob и повторное создание снаряжения: set_mob только заменяет вид на данном месте и оставляет поля на этом месте. Перенос сохраняет имя, оружие, броню, чары, отделку, окраску, щиты, эффекты, атрибуты и все ручные настройки; не перечисляй их заново. Если персонажа явно не назвали, используй историю и текущее состояние для определения персонажа, а не всегда index 0; уже сидящего на нужном мобе повторно не добавляй.",
      'Примеры доработки: [зомби в алмазной броне] + "Посади его на паука" → {"operations":[{"action":"mount_mob","index":0,"mobType":"spider"}]}, получится [паук, тот же зомби в алмазной броне]. [зомби-рыцарь] + "Посади его на лошадь" → {"operations":[{"action":"mount_mob","index":0,"mobType":"horse"}]}, получится [лошадь, тот же рыцарь]. [зомби-рыцарь, лошадь] + "Наоборот, рыцарь должен сидеть на лошади" → {"operations":[{"action":"move_mob","index":1,"toIndex":0}]}. [лошадь, зомби-рыцарь] + "Посади рыцаря на свинью" → {"operations":[{"action":"mount_mob","index":1,"mobType":"pig"}]}, получится [лошадь, свинья, тот же рыцарь]. Если также просят изменить рыцаря, применяй настройки к его НОВОМУ индексу после переноса.',
      "dropChance заполняй только если пользователь явно просит шанс выпадения; иначе не указывай.",
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
    "Единицы текущего snapshot: food-eff-dur-N и totem-eff-dur-N — длительность В ТИКАХ (20 тиков = 1 секунда); food-eff-amp-N и totem-eff-amp-N — amplifier (уровень минус 1). В операции durationSeconds — СЕКУНДЫ, level — человеческий уровень. Если просят изменить только уровень существующего эффекта, передавай только index, effectId, level, БЕЗ durationSeconds: сервер сам сохранит время. Аналогично не повторяй неизменённые свойства других операций.",
    "Если передано текущее состояние, верни ТОЛЬКО изменения из нового запроса. Сохраняй остальные поля, имя, лор, количество, получателя, слои узора и взрывы. Состояние важнее истории; не повторяй старые операции. Без состояния собери с нуля.",
    "Удаление: remove_enchant(enchantId); reset_field(field) сбрасывает поле (имя, лор, числовую настройку) к значению по умолчанию. set_boolean value=false отключает dye-on, trim-on, shield-on, totem-on и прочие флаги. remove_food_effect(index), remove_totem_effect(index), remove_shield_layer(index), clear_shield_layers(), remove_firework(index), clear_fireworks(). Не добавляй чары, которые пользователь просит убрать.",
    "set_text поддерживает lore-0..lore-4, lore-color-0..lore-color-4. set_shield(color) меняет только базовый цвет; set_shield(pattern,color,index) меняет слой узора, index=текущая длина добавляет слой; без index новый pattern добавляется в конец. set_shield(index,color) перекрашивает существующий слой без смены узора. set_firework(index,shape,colors,fadeColors,trail,twinkle) меняет только указанные свойства взрыва; index=текущая длина добавляет взрыв. Нумерация всех массивов с 0.",
    "Если новый запрос называет другой предмет, обязательно сначала верни set_item(itemId), даже при переданном snapshot: например, запрос про щит при текущем мече требует set_item shield ПЕРЕД set_shield. Запрос про кожаную куртку при другом предмете требует set_item leather_chestplate ПЕРЕД set_dye. Не считай это запретом на смену предмета. При смене предмета сохраняй совместимые настройки и предупреди о несовместимых. Не ставь сброс количества или получателя без явной просьбы.",
    "Операции give: set_item(itemId), set_count(count), set_target(target), set_text(field,value), set_boolean(field,value), set_enchant(enchantId,level), set_trim(material,pattern), set_dye(color), set_shield(index,color,pattern), set_potion(potionType,potionModifier), set_food_effect(index,effectId,level,durationSeconds), set_totem_effect(index,effectId,level,durationSeconds), set_firework(shape,colors,fadeColors,trail,twinkle).",
    'Пример красного щита с белым прямым крестом и чёрной рамкой: {"operations":[{"action":"set_item","itemId":"shield"},{"action":"set_shield","color":"red"},{"action":"set_shield","index":0,"pattern":"straight_cross","color":"white"},{"action":"set_shield","index":1,"pattern":"border","color":"black"}]}. Основа — отдельная операция БЕЗ index, слои нумеруются с 0 независимо от основы. pattern — ID из списка без префикса minecraft:.',
    "Для зелий itemId имеет формат potion:effect, а potionType выбирает предмет: potion/splash_potion/lingering_potion/tipped_arrow.",
    `Предметы: ${formatGrouped(GIVE_ITEM_GROUPS, "items")}.`,
    `Эффекты: ${EFFECTS.map(([id, name]) => `${id}=${name}`).join(", ")}.`,
    `Зелья: ${POTIONS.map(([id, name, long, strong]) => `${id}=${name}${long ? ",long" : ""}${strong ? ",strong" : ""}`).join("; ")}.`,
    `Зачарования по предметам: ${formatEnchantFacts([...validGiveItems])}.`,
    `Цвета имён: ${[...nameColors].filter(Boolean).join(", ")}. Красители: ${DYE_COLORS.map(([id]) => id).join(", ")}. Отделки: materials ${TRIM_MATERIALS.map(([id]) => id).join(", ")}; patterns ${TRIM_PATTERNS.map(([id]) => id).join(", ")}. Узоры щита/флага: ${BANNER_PATTERNS.map(([id, name]) => `${id}=${name}`).join(", ")}.`,
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

function applySummonPlan(plan: AiPlan, current?: SummonSnapshot): { snapshot: SummonSnapshot } {
  let snapshot = current ? normalizeSnapshot(current) : toSnapshot(["zombie"]);
  for (const op of plan.operations) {
    const index = op.index ?? 0;
    if (!Number.isInteger(index) || index < 0 || index >= maxMobs) continue;
    if (op.action === "insert_mob" || op.action === "mount_mob") {
      if (op.action === "mount_mob" && !snapshot.mobOrder[index]) continue;
      if (!op.mobType || !validMobs.has(op.mobType) || index > snapshot.mobOrder.length) continue;
      if (snapshot.mobOrder.length >= maxMobs) {
        plan.notes.push("Нельзя добавить ещё одного моба: в цепочке уже 6 мобов. Существующие персонажи сохранены.");
        continue;
      }
      const order: Array<number | string> = snapshot.mobOrder.map((_, i) => i);
      order.splice(index, 0, op.mobType);
      snapshot = reorderSummonMobs(snapshot, order);
      continue;
    }
    if (op.action === "move_mob") {
      if (!snapshot.mobOrder[index] || !Number.isInteger(op.toIndex) || op.toIndex! < 0 || op.toIndex! >= snapshot.mobOrder.length) continue;
      const order = snapshot.mobOrder.map((_, i) => i);
      order.splice(op.toIndex!, 0, order.splice(index, 1)[0]);
      snapshot = reorderSummonMobs(snapshot, order);
      continue;
    }
    if (op.action === "remove_mob") {
      if (!snapshot.mobOrder[index]) continue;
      if (snapshot.mobOrder.length === 1) {
        plan.notes.push("Нельзя удалить единственного моба: в редакторе должен остаться хотя бы один моб.");
        continue;
      }
      snapshot = reorderSummonMobs(snapshot, snapshot.mobOrder.map((_, i) => i).filter(i => i !== index));
      continue;
    }
    if (op.action === "set_mob" && op.mobType && validMobs.has(op.mobType)) {
      snapshot = ensureSummonIndex(snapshot, index, op.mobType);
      snapshot = setSummonField(snapshot, index, "mob", op.mobType);
      continue;
    }
    if (!snapshot.mobOrder[index]) continue;
    if (op.action === "clear_equipment" && op.slot && validSlots.has(op.slot)) {
      const slot = op.slot;
      snapshot = { ...snapshot, fields: Object.fromEntries(Object.entries(snapshot.fields).filter(([key]) => {
        if (!key.startsWith(`${index}-`)) return true;
        const field = key.slice(`${index}-`.length);
        return !["slot", "count", "drop", "dyeon", "dye", "trimon", "trimmat", "trimpat", "shieldon", "shieldbase"].some(prefix => field === `${prefix}-${slot}`) &&
          !["ench", "enchlvl", "shieldpat", "shieldcolor"].some(prefix => field.startsWith(`${prefix}-${slot}-`));
      })) };
    } else if (op.action === "remove_effect" && op.effectId && validEffects.has(op.effectId)) {
      snapshot = setSummonField(snapshot, index, `eff-${op.effectId}`, false);
    } else if (op.action === "remove_equipment_enchant" && op.slot && validSlots.has(op.slot) && op.enchantId) {
      const enchantId = normalizeEnchantId(String(snapshot.fields[`${index}-slot-${op.slot}`] || ""), op.enchantId);
      if (enchantId) snapshot = setSummonField(snapshot, index, `ench-${op.slot}-${enchantId}`, false);
    } else if ((op.action === "clear_equipment_dye" || op.action === "clear_equipment_trim") && op.slot && validSlots.has(op.slot)) {
      snapshot = setSummonField(snapshot, index, `${op.action === "clear_equipment_dye" ? "dyeon" : "trimon"}-${op.slot}`, false);
    } else if (op.action === "reset_number" && op.field && summonNumberFields.has(op.field)) {
      snapshot = setSummonField(snapshot, index, op.field, "");
    } else if (op.action === "set_text" && op.field && summonTextFields.has(op.field) && op.value !== undefined && op.value !== null) {
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
    } else if (op.action === "set_equipment_dye" && op.slot && validSlots.has(op.slot) && leatherColor(op.color)) {
      if (!String(snapshot.fields[`${index}-slot-${op.slot}`] || "").startsWith("leather_")) continue;
      snapshot = setSummonField(snapshot, index, `dyeon-${op.slot}`, true);
      snapshot = setSummonField(snapshot, index, `dye-${op.slot}`, leatherColor(op.color)!);
    } else if (["set_equipment_shield", "clear_equipment_shield", "remove_equipment_shield_layer", "clear_equipment_shield_layers"].includes(op.action) && op.slot && validSlots.has(op.slot)) {
      const slot = op.slot;
      if (!supportsBannerPatterns(String(snapshot.fields[`${index}-slot-${slot}`] || ""))) continue;
      const set = (field: string, value: SummonFieldValue) => { snapshot = setSummonField(snapshot, index, field, value); };
      if (op.action === "clear_equipment_shield") {
        set(`shieldon-${slot}`, false);
      } else if (op.action === "clear_equipment_shield_layers") {
        for (let layer = 0; layer < 16; layer++) {
          set(`shieldpat-${slot}-${layer}`, "");
          set(`shieldcolor-${slot}-${layer}`, "");
        }
      } else if (op.action === "remove_equipment_shield_layer") {
        if (!Number.isInteger(op.layerIndex) || op.layerIndex! < 0 || op.layerIndex! >= 16) continue;
        set(`shieldpat-${slot}-${op.layerIndex}`, "");
        set(`shieldcolor-${slot}-${op.layerIndex}`, "");
      } else if (op.layerIndex !== undefined || op.pattern !== undefined) {
        const layer = op.layerIndex ?? Array.from({ length: 16 }, (_, i) => i).find(i => !snapshot.fields[`${index}-shieldpat-${slot}-${i}`]);
        if (!Number.isInteger(layer) || layer! < 0 || layer! >= 16) continue;
        const previous = String(snapshot.fields[`${index}-shieldpat-${slot}-${layer}`] || "");
        const pattern = op.pattern ?? previous;
        if (!validBannerPatterns.has(pattern) || (op.color !== undefined && !validColors.has(op.color))) continue;
        set(`shieldon-${slot}`, true);
        set(`shieldpat-${slot}-${layer}`, pattern);
        if (op.color !== undefined) set(`shieldcolor-${slot}-${layer}`, op.color);
      } else if (validColors.has(op.color || "")) {
        set(`shieldon-${slot}`, true);
        set(`shieldbase-${slot}`, op.color!);
      }
    } else if (op.action === "set_effect" && op.effectId && validEffects.has(op.effectId)) {
      snapshot = setSummonField(snapshot, index, `eff-${op.effectId}`, true);
      snapshot = setSummonField(snapshot, index, `effamp-${op.effectId}`, String(clampInt((op.level ?? 1) - 1, 0, 255)));
      snapshot = setSummonField(snapshot, index, `effdur-${op.effectId}`, String(clampInt((op.durationSeconds ?? 999999) * 20, 1, 1000000)));
    }
  }
  return { snapshot: normalizeSnapshot(snapshot) };
}

function applyGivePlan(plan: AiPlan, prompt: string, current?: GiveSnapshot): { snapshot: GiveSnapshot } {
  const snapshot = current ? structuredClone(current) : defaultGiveSnapshot();
  if (!current) snapshot.shieldLayers = [];
  for (const op of plan.operations) {
    if (op.action === "set_item" && op.itemId && validGiveItems.has(op.itemId)) {
      snapshot.itemId = op.itemId;
      if (isPotion(op.itemId) && !isPotion(current?.itemId || "")) snapshot.potionType = "potion";
    } else if (op.action === "set_count") {
      snapshot.count = String(clampInt(op.count ?? numberFromValue(op.value, 1), 1, 64));
    } else if (op.action === "set_target" && op.target) {
      if (validGiveTargets.has(op.target)) { snapshot.target = op.target; snapshot.targetCustom = ""; }
      else if (op.target.startsWith("@")) snapshot.targetCustom = op.target.slice(0, 120);
    } else if (op.action === "set_text" && op.field && (giveTextFields.has(op.field) || /^lore-(?:color-)?[0-4]$/.test(op.field)) && op.value !== undefined && op.value !== null) {
      const value = String(op.value).slice(0, 120);
      if ((op.field === "name-color" || op.field.startsWith("lore-color-")) && !nameColors.has(value)) continue;
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
    } else if (op.action === "set_dye" && leatherColor(op.color) && snapshot.itemId.startsWith("leather_")) {
      snapshot.fields["dye-on"] = true;
      snapshot.fields["dye-color"] = leatherColor(op.color)!;
    } else if (op.action === "set_shield" && supportsBannerPatterns(snapshot.itemId)) {
      if (op.color !== undefined && !validColors.has(op.color)) continue;
      if (op.pattern !== undefined || op.index !== undefined) {
        const index = op.index ?? snapshot.shieldLayers.length;
        if (!Number.isInteger(index) || index < 0 || index > snapshot.shieldLayers.length || index >= 16) continue;
        const previous = snapshot.shieldLayers[index];
        const pattern = op.pattern ?? previous?.pattern;
        if (!validBannerPatterns.has(pattern || "")) continue;
        snapshot.shieldLayers[index] = { id: previous?.id ?? Date.now() + Math.random(), pattern: pattern!, color: op.color ?? previous?.color ?? "black" };
      } else if (op.color !== undefined) {
        snapshot.fields["shield-base"] = op.color;
      } else continue;
      snapshot.fields["shield-on"] = true;
    } else if (op.action === "set_potion") {
      applyPotion(snapshot, op);
    } else if (op.action === "set_food_effect" && op.effectId && validEffects.has(op.effectId)) {
      setGiveEffect(snapshot.fields, "food", clampInt(op.index ?? 0, 0, 4), op.effectId, op.level, op.durationSeconds);
    } else if (op.action === "set_totem_effect" && op.effectId && validEffects.has(op.effectId)) {
      snapshot.fields["totem-on"] = true;
      setGiveEffect(snapshot.fields, "totem", clampInt(op.index ?? 0, 0, 2), op.effectId, op.level, op.durationSeconds);
    } else if (op.action === "set_firework") {
      const index = op.index ?? 0;
      if (!Number.isInteger(index) || index < 0 || index > snapshot.explosions.length || index >= 8) continue;
      snapshot.itemId = "firework_rocket";
      const previous = snapshot.explosions[index];
      snapshot.explosions[index] = freshExplosion({ ...previous, ...op });
      if (previous) snapshot.explosions[index].id = previous.id;
    } else if (op.action === "remove_enchant" && op.enchantId) {
      const enchantId = normalizeEnchantId(snapshot.itemId, op.enchantId);
      if (enchantId) {
        delete snapshot.fields[`ench-${enchantId}`];
        delete snapshot.fields[`enchlvl-${enchantId}`];
      }
    } else if (op.action === "reset_field" && op.field &&
      (giveTextFields.has(op.field) || giveBooleanFields.has(op.field) || /^lore-(?:color-)?[0-4]$/.test(op.field))) {
      const fallback = defaultGiveSnapshot().fields[op.field];
      if (fallback === undefined) delete snapshot.fields[op.field];
      else snapshot.fields[op.field] = fallback;
    } else if ((op.action === "remove_food_effect" || op.action === "remove_totem_effect") && Number.isInteger(op.index)) {
      const prefix = op.action === "remove_food_effect" ? "food" : "totem";
      if (op.index! >= 0 && op.index! < (prefix === "food" ? 5 : 3)) snapshot.fields[`${prefix}-eff-on-${op.index}`] = false;
    } else if (op.action === "remove_shield_layer" && Number.isInteger(op.index) && op.index! >= 0) {
      snapshot.shieldLayers = snapshot.shieldLayers.filter((_, index) => index !== op.index);
    } else if (op.action === "clear_shield_layers") {
      snapshot.shieldLayers = [];
    } else if (op.action === "remove_firework" && Number.isInteger(op.index) && op.index! >= 0) {
      snapshot.explosions = snapshot.explosions.filter((_, index) => index !== op.index);
    } else if (op.action === "clear_fireworks") {
      snapshot.explosions = [];
    }
  }
  // Text fallbacks are only for fresh descriptions; refinements may explicitly remove an enchantment.
  if (!current && !plan.operations.some(op => op.action === "remove_enchant") && !/(убер|убра|удал|сним|без |не добав|не нуж|не надо)/iu.test(prompt)) applyGivePromptFallbacks(snapshot, prompt);
  for (const key of Object.keys(snapshot.fields)) {
    if (!key.startsWith("ench-")) continue;
    const enchantId = key.slice(5);
    if (!enchantAllowed(snapshot.itemId, enchantId)) {
      if (snapshot.fields[key] === true || snapshot.fields[key] === "true") {
        plan.notes.push(`Зачарование ${enchantId} не подходит для выбранного предмета и убрано.`);
      }
      delete snapshot.fields[key];
      delete snapshot.fields[`enchlvl-${enchantId}`];
    }
  }
  if (current && current.itemId !== snapshot.itemId) {
    const enabled = (field: string) => snapshot.fields[field] === true || snapshot.fields[field] === "true";
    const ignored: string[] = [];
    if (enabled("dye-on") && !snapshot.itemId.startsWith("leather_")) ignored.push("окраска кожи");
    if (enabled("trim-on") && !canHaveTrim(snapshot.itemId)) ignored.push("отделка брони");
    if (enabled("shield-on") && !supportsBannerPatterns(snapshot.itemId)) ignored.push("узоры щита или флага");
    if (snapshot.explosions.length && snapshot.itemId !== "firework_rocket") ignored.push("взрывы фейерверка");
    if (!FOOD_ITEMS.has(snapshot.itemId) && Object.keys(snapshot.fields).some(key => /^food-eff-on-/.test(key) && enabled(key))) ignored.push("эффекты еды");
    if (ignored.length) plan.notes.push(`Для выбранного предмета не применяются: ${ignored.join(", ")}. Эти настройки не входят в команду.`);
  }
  if (isPotion(snapshot.itemId)) {
    const options = potionOptions(snapshot.itemId);
    if ((snapshot.potionModifier === "long" && !options.hasLong) || (snapshot.potionModifier === "strong" && !options.hasStrong)) {
      snapshot.potionModifier = "normal";
      plan.notes.push("Выбранное зелье не поддерживает прежнее усиление или длительность; установлен обычный вариант.");
    }
  }
  return { snapshot };
}

// Reindex every field together, including settings unknown to the AI operation schema.
// Numbers identify existing mobs; strings create fresh mobs with editor defaults.
function reorderSummonMobs(snapshot: SummonSnapshot, order: Array<number | string>): SummonSnapshot {
  const fields: SummonSnapshot["fields"] = {};
  const mobOrder = order.map((source, index) => {
    if (typeof source === "string") {
      const fresh = toSnapshot([source]);
      for (const [key, value] of Object.entries(fresh.fields)) fields[`${index}-${key.slice(2)}`] = value;
      return { mobType: source };
    }
    const prefix = `${source}-`;
    for (const [key, value] of Object.entries(snapshot.fields)) {
      if (key.startsWith(prefix)) fields[`${index}-${key.slice(prefix.length)}`] = value;
    }
    return { ...snapshot.mobOrder[source] };
  });
  return normalizeSnapshot({ mobOrder, fields });
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

function leatherColor(value: unknown): string | undefined {
  if (isHexColor(value)) return value;
  return DYE_COLORS.find(([id]) => id === value)?.[2];
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

function setGiveEffect(fields: Record<string, GiveFieldValue>, kind: "food" | "totem", index: number, effectId: string, level?: number, durationSeconds?: number) {
  const prefix = kind === "food" ? "food-eff" : "totem-eff";
  const existing = fields[`${prefix}-${index}`] === effectId;
  const amplifier = level === undefined && existing ? numberFromValue(fields[`${prefix}-amp-${index}`], 0) : (level ?? 1) - 1;
  const duration = durationSeconds === undefined && existing ? numberFromValue(fields[`${prefix}-dur-${index}`], 200) : (durationSeconds ?? 10) * 20;
  fields[`${prefix}-on-${index}`] = true;
  fields[`${prefix}-${index}`] = effectId;
  fields[`${prefix}-amp-${index}`] = String(clampInt(amplifier, 0, 255));
  fields[`${prefix}-dur-${index}`] = String(clampInt(duration, 1, 1000000));
  if (kind === "food" && fields[`${prefix}-prob-${index}`] === undefined) fields[`${prefix}-prob-${index}`] = "1.0";
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
