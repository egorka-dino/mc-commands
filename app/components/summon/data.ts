export type SummonFieldValue = string | number | boolean | null;

export type SummonSnapshot = {
  mobOrder: Array<{ mobType: string }>;
  fields: Record<string, SummonFieldValue>;
};

export type SummonTemplateLike = SummonSnapshot & {
  id: string;
  category: string;
  name: string;
  description: string;
  version: number;
  enabled?: boolean;
};

export const RANDOM_MOBS = [
  "zombie", "husk", "drowned", "skeleton", "stray", "wither_skeleton", "bogged",
  "creeper", "spider", "cave_spider", "enderman", "silverfish", "zombified_piglin",
  "piglin", "piglin_brute", "blaze", "magma_cube", "slime", "hoglin", "zoglin",
  "vex", "evoker", "vindicator", "pillager", "ravager", "witch", "phantom",
  "guardian", "warden", "breeze", "creaking", "wolf", "fox", "goat", "bee",
  "iron_golem", "snow_golem", "cow", "pig", "sheep", "chicken", "rabbit",
  "horse", "skeleton_horse", "zombie_horse", "cat", "parrot", "villager",
  "axolotl", "frog", "turtle", "camel", "sniffer", "armadillo", "allay",
  "strider", "happy_ghast",
];

export const RANDOM_NAMES = [
  "Громила", "Искатель", "Шалун", "Хранитель", "Капитан", "Бродяга",
  "Сюрприз", "Прыг-Скок", "Ночной гость", "Легенда", "Зубастик", "Босс",
];

export {
  ALL_MOBS,
  BANNER_PATTERNS,
  BABY_MOBS as RANDOM_BABY_MOBS,
  canHaveTrim,
  COMMAND_LEVEL_MAX,
  DYE_COLORS,
  EFFECTS,
  ENCHANTS,
  enchantsForItem,
  isFireball,
  supportsBannerPatterns,
  ITEM_NAMES,
  MOB_GROUPS,
  NAME_COLORS,
  SUMMON_EQUIPMENT_SLOTS as SLOTS,
  TRIM_MATERIALS,
  TRIM_PATTERNS,
} from "../minecraft/data";
