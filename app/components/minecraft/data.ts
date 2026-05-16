export type OptionPair = readonly [string, string];
export type ColorOption = readonly [string, string, string];
export type EnchantInfo = {
  id: string;
  name: string;
  max: number;
};

export const POTIONS = [
  ["swiftness", "Зелье скорости", true, true],
  ["slowness", "Зелье замедления", true, true],
  ["strength", "Зелье силы", true, true],
  ["healing", "Зелье исцеления", false, true],
  ["harming", "Зелье вреда", false, true],
  ["regeneration", "Зелье регенерации", true, true],
  ["poison", "Зелье яда", true, true],
  ["fire_resistance", "Зелье огнестойкости", true, false],
  ["water_breathing", "Зелье подводного дыхания", true, false],
  ["night_vision", "Зелье ночного зрения", true, false],
  ["invisibility", "Зелье невидимости", true, false],
  ["leaping", "Зелье прыгучести", true, true],
  ["weakness", "Зелье слабости", true, false],
  ["luck", "Зелье удачи", false, false],
  ["turtle_master", "Зелье черепахи", true, true],
  ["slow_falling", "Зелье медленного падения", true, false],
  ["wind_charged", "Зелье ветряного заряда", false, false],
  ["weaving", "Зелье плетения", false, false],
  ["oozing", "Зелье просачивания", false, false],
  ["infested", "Зелье заражения", false, false],
] as const satisfies readonly (readonly [string, string, boolean, boolean])[];

export const GIVE_ITEM_GROUPS = [
  { name: "Мечи", items: [
    ["wooden_sword", "Деревянный меч"], ["stone_sword", "Каменный меч"],
    ["iron_sword", "Железный меч"], ["golden_sword", "Золотой меч"],
    ["diamond_sword", "Алмазный меч"], ["netherite_sword", "Незеритовый меч"],
  ] },
  { name: "Топоры", items: [
    ["wooden_axe", "Деревянный топор"], ["stone_axe", "Каменный топор"],
    ["iron_axe", "Железный топор"], ["golden_axe", "Золотой топор"],
    ["diamond_axe", "Алмазный топор"], ["netherite_axe", "Незеритовый топор"],
  ] },
  { name: "Луки и арбалеты", items: [
    ["bow", "Лук"], ["crossbow", "Арбалет"],
  ] },
  { name: "Копья", items: [
    ["wooden_spear", "Деревянное копьё"], ["stone_spear", "Каменное копьё"],
    ["copper_spear", "Медное копьё"], ["iron_spear", "Железное копьё"],
    ["golden_spear", "Золотое копьё"], ["diamond_spear", "Алмазное копьё"],
    ["netherite_spear", "Незеритовое копьё"],
  ] },
  { name: "Другое оружие", items: [
    ["trident", "Трезубец"], ["mace", "Булава"],
  ] },
  { name: "Кирки", items: [
    ["wooden_pickaxe", "Деревянная кирка"], ["stone_pickaxe", "Каменная кирка"],
    ["iron_pickaxe", "Железная кирка"], ["golden_pickaxe", "Золотая кирка"],
    ["diamond_pickaxe", "Алмазная кирка"], ["netherite_pickaxe", "Незеритовая кирка"],
  ] },
  { name: "Лопаты", items: [
    ["wooden_shovel", "Деревянная лопата"], ["stone_shovel", "Каменная лопата"],
    ["iron_shovel", "Железная лопата"], ["golden_shovel", "Золотая лопата"],
    ["diamond_shovel", "Алмазная лопата"], ["netherite_shovel", "Незеритовая лопата"],
  ] },
  { name: "Мотыги", items: [
    ["wooden_hoe", "Деревянная мотыга"], ["stone_hoe", "Каменная мотыга"],
    ["iron_hoe", "Железная мотыга"], ["golden_hoe", "Золотая мотыга"],
    ["diamond_hoe", "Алмазная мотыга"], ["netherite_hoe", "Незеритовая мотыга"],
  ] },
  { name: "Другие инструменты", items: [
    ["shears", "Ножницы"], ["flint_and_steel", "Кремень и сталь"],
    ["fishing_rod", "Удочка"], ["carrot_on_a_stick", "Морковка на удочке"],
    ["warped_fungus_on_a_stick", "Деформированный гриб на удочке"],
    ["brush", "Кисть"], ["spyglass", "Подзорная труба"],
    ["compass", "Компас"], ["recovery_compass", "Компас восстановления"],
    ["clock", "Часы"], ["map", "Карта"], ["filled_map", "Заполненная карта"],
  ] },
  { name: "Шлемы", items: [
    ["leather_helmet", "Кожаный шлем"], ["chainmail_helmet", "Кольчужный шлем"],
    ["iron_helmet", "Железный шлем"], ["golden_helmet", "Золотой шлем"],
    ["diamond_helmet", "Алмазный шлем"], ["netherite_helmet", "Незеритовый шлем"],
    ["turtle_helmet", "Черепаший панцирь"], ["carved_pumpkin", "Вырезанная тыква"],
    ["player_head", "Голова игрока"], ["zombie_head", "Голова зомби"],
    ["skeleton_skull", "Череп скелета"], ["creeper_head", "Голова крипера"],
    ["dragon_head", "Голова дракона"], ["piglin_head", "Голова пиглина"],
  ] },
  { name: "Нагрудники", items: [
    ["leather_chestplate", "Кожаный нагрудник"], ["chainmail_chestplate", "Кольчужный нагрудник"],
    ["iron_chestplate", "Железный нагрудник"], ["golden_chestplate", "Золотой нагрудник"],
    ["diamond_chestplate", "Алмазный нагрудник"], ["netherite_chestplate", "Незеритовый нагрудник"],
    ["elytra", "Элитры"],
  ] },
  { name: "Штаны", items: [
    ["leather_leggings", "Кожаные штаны"], ["chainmail_leggings", "Кольчужные штаны"],
    ["iron_leggings", "Железные штаны"], ["golden_leggings", "Золотые штаны"],
    ["diamond_leggings", "Алмазные штаны"], ["netherite_leggings", "Незеритовые штаны"],
  ] },
  { name: "Ботинки", items: [
    ["leather_boots", "Кожаные ботинки"], ["chainmail_boots", "Кольчужные ботинки"],
    ["iron_boots", "Железные ботинки"], ["golden_boots", "Золотые ботинки"],
    ["diamond_boots", "Алмазные ботинки"], ["netherite_boots", "Незеритовые ботинки"],
  ] },
  { name: "Щиты", items: [
    ["shield", "Щит"],
  ] },
  { name: "Еда", items: [
    ["apple", "Яблоко"], ["golden_apple", "Золотое яблоко"], ["enchanted_golden_apple", "Зачарованное золотое яблоко"],
    ["bread", "Хлеб"], ["cooked_beef", "Стейк"], ["beef", "Сырая говядина"],
    ["cooked_porkchop", "Жареная свинина"], ["porkchop", "Сырая свинина"],
    ["cooked_chicken", "Жареная курица"], ["chicken", "Сырая курица"],
    ["cooked_mutton", "Жареная баранина"], ["mutton", "Сырая баранина"],
    ["cooked_rabbit", "Жареный кролик"], ["rabbit", "Сырой кролик"],
    ["cooked_cod", "Жареная треска"], ["cod", "Сырая треска"],
    ["cooked_salmon", "Жареный лосось"], ["salmon", "Сырой лосось"],
    ["tropical_fish", "Тропическая рыба"], ["pufferfish", "Рыба-фугу"],
    ["carrot", "Морковь"], ["golden_carrot", "Золотая морковь"],
    ["potato", "Картофель"], ["baked_potato", "Запечённый картофель"], ["poisonous_potato", "Ядовитый картофель"],
    ["melon_slice", "Долька дыни"], ["glistering_melon_slice", "Блестящая долька дыни"],
    ["pumpkin_pie", "Тыквенный пирог"],
    ["mushroom_stew", "Грибной суп"], ["rabbit_stew", "Рагу из кролика"], ["beetroot_soup", "Суп из свёклы"],
    ["suspicious_stew", "Подозрительное рагу"],
    ["cookie", "Печенье"], ["honey_bottle", "Бутылочка мёда"], ["dried_kelp", "Сушёная ламинария"],
    ["sweet_berries", "Сладкие ягоды"], ["glow_berries", "Светящиеся ягоды"],
    ["chorus_fruit", "Плод хоруса"], ["beetroot", "Свёкла"],
    ["rotten_flesh", "Гнилая плоть"], ["spider_eye", "Паучий глаз"],
  ] },
  { name: "Зелья", items: POTIONS.map(([id, name]) => [`potion:${id}`, name]) },
  { name: "Стрелы", items: [
    ["arrow", "Стрела"], ["spectral_arrow", "Спектральная стрела"],
  ] },
  { name: "Блоки", items: [
    ["command_block", "Командный блок"], ["chain_command_block", "Цепной командный блок"], ["repeating_command_block", "Повторяющийся командный блок"],
    ["chest", "Сундук"], ["trapped_chest", "Сундук-ловушка"], ["ender_chest", "Эндер-сундук"],
    ["shulker_box", "Ящик шалкера"],
    ["furnace", "Печь"], ["blast_furnace", "Доменная печь"], ["smoker", "Коптильня"],
    ["crafting_table", "Верстак"], ["enchanting_table", "Стол зачарований"], ["anvil", "Наковальня"],
    ["beacon", "Маяк"], ["conduit", "Проводник"],
    ["spawner", "Спаунер"], ["trial_spawner", "Испытательный спаунер"], ["vault", "Хранилище"],
    ["barrier", "Барьер"], ["light", "Свет"], ["structure_void", "Структурная пустота"],
    ["stone", "Камень"], ["cobblestone", "Булыжник"], ["obsidian", "Обсидиан"], ["crying_obsidian", "Плачущий обсидиан"],
    ["netherrack", "Незеррак"], ["end_stone", "Камень Края"], ["deepslate", "Глубинный сланец"],
    ["glass", "Стекло"], ["tinted_glass", "Тонированное стекло"],
    ["dirt", "Земля"], ["grass_block", "Блок травы"], ["sand", "Песок"], ["gravel", "Гравий"],
    ["oak_log", "Дубовое бревно"], ["oak_planks", "Дубовые доски"],
    ["tnt", "Динамит"], ["respawn_anchor", "Якорь возрождения"],
    ["structure_block", "Блок структуры"], ["jigsaw", "Блок джигсо"],
  ] },
  { name: "Материалы", items: [
    ["iron_ingot", "Железный слиток"], ["gold_ingot", "Золотой слиток"],
    ["netherite_ingot", "Незеритовый слиток"], ["netherite_scrap", "Незеритовый обломок"],
    ["diamond", "Алмаз"], ["emerald", "Изумруд"], ["amethyst_shard", "Осколок аметиста"],
    ["lapis_lazuli", "Лазурит"], ["redstone", "Красный камень"], ["quartz", "Кварц"],
    ["coal", "Уголь"], ["charcoal", "Древесный уголь"], ["flint", "Кремень"],
    ["string", "Нить"], ["feather", "Перо"], ["leather", "Кожа"], ["white_wool", "Белая шерсть"],
    ["bone", "Кость"], ["bone_meal", "Костяная мука"],
    ["blaze_rod", "Огненный стержень"], ["blaze_powder", "Огненный порошок"],
    ["ender_pearl", "Жемчуг Края"], ["ender_eye", "Глаз Края"],
    ["ghast_tear", "Слеза гаста"], ["magma_cream", "Магмовый крем"],
    ["phantom_membrane", "Мембрана фантома"], ["nautilus_shell", "Раковина наутилуса"],
    ["heart_of_the_sea", "Морское сердце"], ["turtle_scute", "Черепашья чешуйка"],
    ["armadillo_scute", "Чешуйка броненосца"], ["breeze_rod", "Стержень бриза"],
    ["rabbit_foot", "Заячья лапка"], ["rabbit_hide", "Заячья шкурка"],
    ["paper", "Бумага"], ["book", "Книга"], ["writable_book", "Книга и перо"], ["written_book", "Написанная книга"],
    ["name_tag", "Бирка"], ["lead", "Поводок"], ["saddle", "Седло"],
    ["stick", "Палка"], ["bowl", "Миска"],
    ["snowball", "Снежок"], ["egg", "Яйцо"], ["fire_charge", "Огненный шар"],
    ["experience_bottle", "Бутылка опыта"], ["glass_bottle", "Стеклянная бутылка"],
    ["bucket", "Ведро"], ["water_bucket", "Ведро воды"], ["lava_bucket", "Ведро лавы"], ["milk_bucket", "Ведро молока"],
    ["nether_star", "Звезда Нижнего мира"], ["resin_clump", "Комок смолы"],
  ] },
  { name: "Особые", items: [
    ["totem_of_undying", "Тотем бессмертия"],
    ["nether_star", "Звезда Нижнего мира"],
    ["dragon_egg", "Яйцо дракона"],
    ["firework_rocket", "Фейерверк"], ["firework_star", "Звезда фейерверка"],
    ["bundle", "Связка"],
    ["knowledge_book", "Книга знаний"],
    ["debug_stick", "Отладочная палка"],
    ["trial_key", "Ключ испытания"], ["ominous_trial_key", "Зловещий ключ испытания"],
    ["ominous_bottle", "Зловещая бутылка"], ["wind_charge", "Ветровой заряд"],
  ] },
] as const;

export const ALL_ITEMS = Object.fromEntries(
  GIVE_ITEM_GROUPS.flatMap((group) => group.items.map(([id, name]) => [id, name])),
) as Record<string, string>;

export const ITEM_NAMES = {
  ...ALL_ITEMS,
  torch: "Факел",
} as Record<string, string>;

export const MOB_GROUPS = [
  { name: "Враждебные", mobs: [
    ["zombie", "Зомби"], ["husk", "Кадавр"], ["drowned", "Утопленник"], ["zombie_villager", "Зомби-житель"],
    ["skeleton", "Скелет"], ["stray", "Заблудший"], ["wither_skeleton", "Скелет-иссушитель"], ["bogged", "Замшелый скелет"],
    ["creeper", "Крипер"], ["spider", "Паук"], ["cave_spider", "Пещерный паук"],
    ["enderman", "Странник Края"], ["endermite", "Эндермит"], ["silverfish", "Чешуйница"],
    ["zombified_piglin", "Зомби-пиглин"], ["piglin", "Пиглин"], ["piglin_brute", "Пиглин-громила"],
    ["blaze", "Ифрит"], ["ghast", "Гаст"], ["magma_cube", "Магма-куб"], ["slime", "Слизень"],
    ["hoglin", "Хоглин"], ["zoglin", "Зоглин"], ["shulker", "Шалкер"], ["vex", "Досаждатель"],
    ["evoker", "Призыватель"], ["vindicator", "Поборник"], ["pillager", "Разбойник"],
    ["ravager", "Разоритель"], ["illusioner", "Иллюзионист"], ["witch", "Ведьма"], ["phantom", "Фантом"],
    ["guardian", "Страж"], ["elder_guardian", "Древний страж"], ["warden", "Хранитель"],
    ["breeze", "Бриз"], ["creaking", "Скрипень"],
  ] },
  { name: "Боссы", mobs: [
    ["ender_dragon", "Дракон Края"], ["wither", "Иссушитель"],
  ] },
  { name: "Нейтральные", mobs: [
    ["wolf", "Волк"], ["polar_bear", "Белый медведь"], ["panda", "Панда"], ["dolphin", "Дельфин"],
    ["fox", "Лиса"], ["goat", "Коза"], ["llama", "Лама"], ["trader_llama", "Торговая лама"],
    ["bee", "Пчела"], ["iron_golem", "Железный голем"], ["snow_golem", "Снежный голем"],
    ["pufferfish", "Рыба-фугу"],
  ] },
  { name: "Мирные", mobs: [
    ["cow", "Корова"], ["mooshroom", "Грибная корова"], ["pig", "Свинья"], ["sheep", "Овца"],
    ["chicken", "Курица"], ["rabbit", "Кролик"],
    ["horse", "Лошадь"], ["donkey", "Осёл"], ["mule", "Мул"], ["skeleton_horse", "Скелет-лошадь"], ["zombie_horse", "Зомби-лошадь"],
    ["cat", "Кошка"], ["ocelot", "Оцелот"], ["parrot", "Попугай"],
    ["villager", "Житель"], ["wandering_trader", "Странствующий торговец"],
    ["axolotl", "Аксолотль"], ["frog", "Лягушка"], ["tadpole", "Головастик"], ["turtle", "Черепаха"],
    ["bat", "Летучая мышь"], ["squid", "Кальмар"], ["glow_squid", "Сияющий кальмар"],
    ["cod", "Треска"], ["salmon", "Лосось"], ["tropical_fish", "Тропическая рыба"],
    ["camel", "Верблюд"], ["sniffer", "Нюхач"], ["armadillo", "Броненосец"], ["allay", "Аллай"],
    ["strider", "Лавоход"], ["happy_ghast", "Добрый гаст"],
  ] },
  { name: "Прочее", mobs: [
    ["armor_stand", "Стойка для брони"], ["item_frame", "Рамка"], ["glow_item_frame", "Сияющая рамка"],
    ["minecart", "Вагонетка"], ["boat", "Лодка"], ["tnt", "Динамит"],
    ["fireball", "Фаерболл"], ["firework_rocket", "Фейерверк"], ["experience_orb", "Сфера опыта"],
    ["lightning_bolt", "Молния"], ["area_effect_cloud", "Облако эффектов"],
  ] },
] as const;

export const ALL_MOBS = Object.fromEntries(
  MOB_GROUPS.flatMap((group) => group.mobs.map(([id, name]) => [id, name])),
) as Record<string, string>;

export const BABY_MOBS = new Set([
  "zombie", "husk", "drowned", "zombie_villager", "zombified_piglin", "piglin",
  "hoglin", "zoglin", "cow", "mooshroom", "pig", "sheep", "chicken", "rabbit",
  "horse", "donkey", "mule", "cat", "ocelot", "fox", "goat", "llama",
  "trader_llama", "wolf", "panda", "bee", "villager", "turtle", "camel",
  "sniffer", "armadillo",
]);

export const SUMMON_EQUIPMENT_SLOTS = [
  { key: "head", label: "Шлем", items: ["netherite_helmet", "diamond_helmet", "iron_helmet", "golden_helmet", "chainmail_helmet", "leather_helmet", "turtle_helmet", "carved_pumpkin", "player_head", "zombie_head", "skeleton_skull", "creeper_head", "dragon_head", "piglin_head"] },
  { key: "chest", label: "Нагрудник", items: ["netherite_chestplate", "diamond_chestplate", "iron_chestplate", "golden_chestplate", "chainmail_chestplate", "leather_chestplate", "elytra"] },
  { key: "legs", label: "Штаны", items: ["netherite_leggings", "diamond_leggings", "iron_leggings", "golden_leggings", "chainmail_leggings", "leather_leggings"] },
  { key: "feet", label: "Ботинки", items: ["netherite_boots", "diamond_boots", "iron_boots", "golden_boots", "chainmail_boots", "leather_boots"] },
  { key: "mainhand", label: "Правая рука (оружие)", items: ["netherite_sword", "diamond_sword", "iron_sword", "golden_sword", "stone_sword", "wooden_sword", "netherite_axe", "diamond_axe", "iron_axe", "golden_axe", "stone_axe", "bow", "crossbow", "trident", "mace", "totem_of_undying", "shield", "stick", "blaze_rod", "nether_star", "ender_pearl", "snowball", "egg", "fire_charge"] },
  { key: "offhand", label: "Левая рука", items: ["totem_of_undying", "shield", "bow", "crossbow", "torch", "arrow", "spectral_arrow", "firework_rocket", "glow_berries", "nether_star", "map"] },
] as const;

export const FOOD_ITEMS = new Set<string>([
  "apple", "golden_apple", "enchanted_golden_apple",
  "bread", "cooked_beef", "beef", "cooked_porkchop", "porkchop",
  "cooked_chicken", "chicken", "cooked_mutton", "mutton",
  "cooked_rabbit", "rabbit", "cooked_cod", "cod", "cooked_salmon", "salmon",
  "tropical_fish", "pufferfish", "rotten_flesh", "spider_eye",
  "carrot", "golden_carrot", "potato", "baked_potato", "poisonous_potato",
  "melon_slice", "glistering_melon_slice", "pumpkin_pie",
  "mushroom_stew", "rabbit_stew", "beetroot_soup", "suspicious_stew",
  "cookie", "honey_bottle", "dried_kelp",
  "sweet_berries", "glow_berries", "chorus_fruit", "beetroot",
  "milk_bucket",
]);

export const ENCHANTS = {
  armor: [
    { id: "protection", name: "Защита", max: 4 },
    { id: "fire_protection", name: "Огнезащита", max: 4 },
    { id: "blast_protection", name: "Взрывозащита", max: 4 },
    { id: "projectile_protection", name: "Защита от снарядов", max: 4 },
    { id: "thorns", name: "Шипы", max: 3 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
    { id: "binding_curse", name: "Проклятие несъёмности", max: 1 },
    { id: "vanishing_curse", name: "Проклятие исчезновения", max: 1 },
  ],
  helmet_extra: [
    { id: "respiration", name: "Подводное дыхание", max: 3 },
    { id: "aqua_affinity", name: "Подводник", max: 1 },
  ],
  boots_extra: [
    { id: "feather_falling", name: "Невесомость", max: 4 },
    { id: "depth_strider", name: "Ходьба по воде", max: 3 },
    { id: "frost_walker", name: "Ледоход", max: 2 },
    { id: "soul_speed", name: "Скольжение по душам", max: 3 },
  ],
  sword: [
    { id: "sharpness", name: "Острота", max: 5 },
    { id: "smite", name: "Небесная кара (нежить)", max: 5 },
    { id: "bane_of_arthropods", name: "Бич членистоногих", max: 5 },
    { id: "knockback", name: "Отбрасывание", max: 2 },
    { id: "fire_aspect", name: "Заговор огня", max: 2 },
    { id: "looting", name: "Добыча", max: 3 },
    { id: "sweeping_edge", name: "Разящий клинок", max: 3 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
    { id: "vanishing_curse", name: "Проклятие исчезновения", max: 1 },
  ],
  bow: [
    { id: "power", name: "Сила", max: 5 },
    { id: "punch", name: "Отдача", max: 2 },
    { id: "flame", name: "Горящая стрела", max: 1 },
    { id: "infinity", name: "Бесконечность", max: 1 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  crossbow: [
    { id: "quick_charge", name: "Быстрая зарядка", max: 3 },
    { id: "multishot", name: "Мультивыстрел", max: 1 },
    { id: "piercing", name: "Пронзание", max: 4 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  trident: [
    { id: "loyalty", name: "Верность", max: 3 },
    { id: "impaling", name: "Пронзающий", max: 5 },
    { id: "riptide", name: "Тягучесть", max: 3 },
    { id: "channeling", name: "Молния", max: 1 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  mace: [
    { id: "density", name: "Плотность", max: 5 },
    { id: "breach", name: "Пробивание", max: 4 },
    { id: "wind_burst", name: "Ветровой взрыв", max: 3 },
    { id: "smite", name: "Небесная кара", max: 5 },
    { id: "fire_aspect", name: "Заговор огня", max: 2 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
  ],
  axe: [
    { id: "sharpness", name: "Острота", max: 5 },
    { id: "smite", name: "Небесная кара", max: 5 },
    { id: "bane_of_arthropods", name: "Бич членистоногих", max: 5 },
    { id: "efficiency", name: "Эффективность", max: 5 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  pickaxe: [
    { id: "efficiency", name: "Эффективность", max: 5 },
    { id: "fortune", name: "Удача", max: 3 },
    { id: "silk_touch", name: "Шёлковое касание", max: 1 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  fishing_rod: [
    { id: "luck_of_the_sea", name: "Рыбацкая удача", max: 3 },
    { id: "lure", name: "Приманка", max: 3 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  shears: [
    { id: "efficiency", name: "Эффективность", max: 5 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  shield: [
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
  ],
  spear: [
    { id: "sharpness", name: "Острота", max: 5 },
    { id: "smite", name: "Небесная кара", max: 5 },
    { id: "bane_of_arthropods", name: "Бич членистоногих", max: 5 },
    { id: "impaling", name: "Пронзающий", max: 5 },
    { id: "lunge", name: "Рывок", max: 3 },
    { id: "knockback", name: "Отбрасывание", max: 2 },
    { id: "fire_aspect", name: "Заговор огня", max: 2 },
    { id: "looting", name: "Добыча", max: 3 },
    { id: "unbreaking", name: "Неразрушимость", max: 3 },
    { id: "mending", name: "Починка", max: 1 },
    { id: "vanishing_curse", name: "Проклятие исчезновения", max: 1 },
  ],
} satisfies Record<string, EnchantInfo[]>;

export function enchantsForItem(itemId: string): EnchantInfo[] {
  if (!itemId) return [];
  if (itemId === "elytra") return [ENCHANTS.armor[5], ENCHANTS.armor[6]];
  if (itemId.endsWith("_helmet") || itemId === "turtle_helmet") return [...ENCHANTS.armor, ...ENCHANTS.helmet_extra];
  if (itemId.endsWith("_chestplate")) return [...ENCHANTS.armor];
  if (itemId.endsWith("_leggings")) return [...ENCHANTS.armor];
  if (itemId.endsWith("_boots")) return [...ENCHANTS.armor, ...ENCHANTS.boots_extra];
  if (itemId.endsWith("_sword")) return ENCHANTS.sword;
  if (itemId.endsWith("_axe")) return ENCHANTS.axe;
  if (itemId === "bow") return ENCHANTS.bow;
  if (itemId === "crossbow") return ENCHANTS.crossbow;
  if (itemId === "trident") return ENCHANTS.trident;
  if (itemId === "mace") return ENCHANTS.mace;
  if (itemId.endsWith("_pickaxe")) return ENCHANTS.pickaxe;
  if (itemId.endsWith("_shovel") || itemId.endsWith("_hoe")) return ENCHANTS.pickaxe;
  if (itemId === "fishing_rod") return ENCHANTS.fishing_rod;
  if (itemId === "shears") return ENCHANTS.shears;
  if (itemId === "shield") return ENCHANTS.shield;
  if (itemId.endsWith("_spear")) return ENCHANTS.spear;
  if (FOOD_ITEMS.has(itemId)) return ENCHANTS.sword;
  return [];
}

export function canHaveTrim(itemId: string) {
  if (!itemId) return false;
  if (itemId === "elytra") return false;
  return itemId.endsWith("_helmet") || itemId === "turtle_helmet"
      || itemId.endsWith("_chestplate")
      || itemId.endsWith("_leggings")
      || itemId.endsWith("_boots");
}

export function isShield(itemId: string) {
  return itemId === "shield";
}

export function isFireball(typeId: string) {
  return typeId === "fireball";
}

export const EFFECTS = [
  ["speed", "Скорость"], ["slowness", "Замедление"], ["haste", "Спешка"], ["mining_fatigue", "Усталость копания"],
  ["strength", "Сила"], ["weakness", "Слабость"], ["jump_boost", "Прыгучесть"], ["regeneration", "Регенерация"],
  ["instant_health", "Мгновенное лечение"], ["instant_damage", "Мгновенный урон"],
  ["poison", "Отравление"], ["wither", "Иссушение"],
  ["resistance", "Сопротивление урону"], ["fire_resistance", "Огнестойкость"], ["water_breathing", "Дыхание под водой"],
  ["invisibility", "Невидимость"], ["night_vision", "Ночное зрение"], ["blindness", "Слепота"],
  ["nausea", "Тошнота"], ["hunger", "Голод"], ["saturation", "Насыщение"],
  ["levitation", "Левитация"], ["glowing", "Свечение"], ["slow_falling", "Медленное падение"],
  ["absorption", "Поглощение"], ["health_boost", "Усиление здоровья"], ["luck", "Удача"],
  ["conduit_power", "Мощь проводника"], ["dolphins_grace", "Грация дельфина"],
  ["hero_of_the_village", "Герой деревни"], ["darkness", "Тьма"], ["bad_omen", "Дурное предзнаменование"],
] as const satisfies readonly OptionPair[];

export const NAME_COLORS = [
  ["", "— без цвета —"], ["white", "белый"], ["gray", "серый"], ["dark_gray", "тёмно-серый"],
  ["black", "чёрный"], ["red", "красный"], ["dark_red", "тёмно-красный"],
  ["gold", "золотой"], ["yellow", "жёлтый"], ["green", "зелёный"], ["dark_green", "тёмно-зелёный"],
  ["aqua", "бирюзовый"], ["dark_aqua", "тёмно-бирюзовый"], ["blue", "синий"], ["dark_blue", "тёмно-синий"],
  ["light_purple", "розовый"], ["dark_purple", "фиолетовый"],
] as const satisfies readonly OptionPair[];

export const TRIM_MATERIALS = [
  ["quartz", "Кварц"], ["iron", "Железо"], ["netherite", "Незерит"], ["redstone", "Редстоун"],
  ["copper", "Медь"], ["gold", "Золото"], ["emerald", "Изумруд"], ["diamond", "Алмаз"],
  ["lapis", "Лазурит"], ["amethyst", "Аметист"], ["resin", "Смола"],
] as const satisfies readonly OptionPair[];

export const TRIM_PATTERNS = [
  ["sentry", "Часовой"], ["dune", "Дюна"], ["coast", "Берег"], ["wild", "Дикарь"],
  ["ward", "Страж"], ["eye", "Око"], ["vex", "Вредина"], ["tide", "Прилив"],
  ["snout", "Рыло"], ["rib", "Ребро"], ["spire", "Шпиль"], ["shaper", "Ваятель"],
  ["silence", "Тишина"], ["raiser", "Возвышение"], ["host", "Хозяин"],
  ["flow", "Поток"], ["bolt", "Молния"], ["wayfinder", "Путеводный"],
] as const satisfies readonly OptionPair[];

export const DYE_COLORS = [
  ["white", "Белый", "#f9fffe"], ["light_gray", "Светло-серый", "#9d9d97"],
  ["gray", "Серый", "#474f52"], ["black", "Чёрный", "#1d1d21"],
  ["brown", "Коричневый", "#835432"], ["red", "Красный", "#b02e26"],
  ["orange", "Оранжевый", "#f9801d"], ["yellow", "Жёлтый", "#fed83d"],
  ["lime", "Лаймовый", "#80c71f"], ["green", "Зелёный", "#5e7c16"],
  ["cyan", "Бирюзовый", "#169c9c"], ["light_blue", "Голубой", "#3ab3da"],
  ["blue", "Синий", "#3c44aa"], ["purple", "Фиолетовый", "#8932b8"],
  ["magenta", "Пурпурный", "#c74ebd"], ["pink", "Розовый", "#f38baa"],
] as const satisfies readonly ColorOption[];

export const BANNER_PATTERNS = [
  ["square_bottom_left", "Нижний левый угол"], ["square_bottom_right", "Нижний правый угол"],
  ["square_top_left", "Верхний левый угол"], ["square_top_right", "Верхний правый угол"],
  ["stripe_bottom", "Нижняя полоса"], ["stripe_top", "Верхняя полоса"],
  ["stripe_left", "Левая полоса"], ["stripe_right", "Правая полоса"],
  ["stripe_center", "Вертикальная полоса"], ["stripe_middle", "Горизонтальная полоса"],
  ["stripe_downright", "Диагональ вниз вправо"], ["stripe_downleft", "Диагональ вниз влево"],
  ["small_stripes", "Частые вертикальные полосы"], ["cross", "Косой крест"],
  ["straight_cross", "Прямой крест"], ["triangle_bottom", "Треугольник снизу"],
  ["triangle_top", "Треугольник сверху"], ["triangles_bottom", "Зубцы снизу"],
  ["triangles_top", "Зубцы сверху"], ["diagonal_left", "Диагональная половина слева"],
  ["diagonal_right", "Диагональная половина справа"], ["diagonal_up_left", "Обратная диагональная половина слева"],
  ["diagonal_up_right", "Обратная диагональная половина справа"], ["circle", "Круг"],
  ["rhombus", "Ромб"], ["half_vertical", "Левая половина"],
  ["half_vertical_right", "Правая половина"], ["half_horizontal", "Верхняя половина"],
  ["half_horizontal_bottom", "Нижняя половина"], ["border", "Кайма"],
  ["curly_border", "Зубчатая кайма"], ["gradient", "Градиент вниз"],
  ["gradient_up", "Градиент вверх"], ["bricks", "Кирпичная кладка"],
  ["globe", "Глобус"], ["creeper", "Крипер"], ["skull", "Череп"],
  ["flower", "Цветок"], ["mojang", "Нечто"], ["piglin", "Рыло пиглина"],
  ["flow", "Поток"], ["guster", "Вихрь"],
] as const satisfies readonly OptionPair[];
