"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_ITEMS,
  BANNER_PATTERNS,
  canHaveTrim,
  DYE_COLORS,
  EFFECTS,
  enchantsForItem,
  FOOD_ITEMS,
  ITEM_GROUPS,
  NAME_COLORS,
  POTIONS,
  TRIM_MATERIALS,
  TRIM_PATTERNS,
} from "./data";
import {
  buildGiveCommand,
  defaultGiveSnapshot,
  type Explosion,
  type GiveFieldValue,
  type GiveSnapshot,
  getGivePreviewData,
  isPotion,
  potionOptions,
  type ShieldLayer,
} from "./engine";

type Favorite = GiveSnapshot & {
  id: string;
  name: string;
  version: number;
  createdAt: number;
  _lastCmd?: string;
};

type ItemGroup = { name: string; items: [string, string][] };
type OptionPair = readonly [string, string, string?];

const itemGroups = ITEM_GROUPS as unknown as ItemGroup[];
const nameColors = NAME_COLORS as unknown as OptionPair[];
const trimMaterials = TRIM_MATERIALS as unknown as OptionPair[];
const trimPatterns = TRIM_PATTERNS as unknown as OptionPair[];
const dyeColors = DYE_COLORS as unknown as readonly (readonly [string, string, string])[];
const bannerPatterns = BANNER_PATTERNS as unknown as OptionPair[];
const effects = EFFECTS as unknown as [string, string][];

const favoriteStorageKey = "mc-give:favorites";
const loreRows = [0, 1, 2, 3, 4];
const foodRows = [0, 1, 2, 3, 4];
const totemRows = [0, 1, 2];
const randomNames = ["Сокровище шахтёра", "Подарок дракона", "Набор героя", "Талисман удачи", "Звёздная находка", "Запас путешественника", "Реликвия крепости", "Лут из данжа"];
const randomLore = ["Сгенерировано mc-commands", "Для приключений и выживания", "Редкая добыча", "Проверено в выживании", "Версия 1.21.5+", "Почти легендарно", "Лучше не терять"];
const randomColors = ["#6ab04c", "#ffb347", "#8ab4f8", "#e55a5a", "#9b59b6", "#f1c40f", "#00d4aa"];
const fireworkShapes = [
  ["small_ball", "Шарик"],
  ["large_ball", "Большой шарик"],
  ["star", "Звезда"],
  ["creeper", "Крипер"],
  ["burst", "Вспышка"],
] as const;

function clampNumberInput(value: string, min: number, max: number, options: { integer?: boolean } = {}) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return String(min);
  const clamped = Math.min(max, Math.max(min, options.integer ? Math.trunc(parsed) : parsed));
  return String(clamped);
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number) {
  return Math.random() < p;
}

function pick<T>(list: readonly T[]): T {
  return list[randInt(0, list.length - 1)];
}

function freshShieldLayer(pattern = "stripe_center", color = "black"): ShieldLayer {
  return { id: Date.now() + Math.random(), pattern, color };
}

function freshExplosion(): Explosion {
  return { id: Date.now() + Math.random(), shape: "small_ball", colors: ["#ff0000"], fadeColors: [], trail: false, twinkle: false };
}

export function GiveEditor() {
  const [snapshot, setSnapshot] = useState<GiveSnapshot>(() => defaultGiveSnapshot());
  const [query, setQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [toast, setToast] = useState("");
  const command = useMemo(() => buildGiveCommand(snapshot), [snapshot]);
  const selectedItem = snapshot.itemId;
  const enchants = useMemo(() => enchantsForItem(selectedItem), [selectedItem]);
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return itemGroups.map((group) => ({
      ...group,
      items: group.items.filter(([id, name]) => !q || id.toLowerCase().includes(q) || name.toLowerCase().includes(q)),
    })).filter((group) => group.items.length);
  }, [query]);
  const longCommand = command.length > 256;
  const autoTarget = snapshot.targetCustom.trim() === "" && snapshot.target === "@s" && longCommand;
  const potionMods = isPotion(selectedItem) ? potionOptions(selectedItem) : { hasLong: false, hasStrong: false };

  useEffect(() => {
    if (!filteredGroups.length) return;
    const visible = filteredGroups.some((group) => group.items.some(([id]) => id === selectedItem));
    if (!visible) onItemChange(filteredGroups[0].items[0][0]);
  }, [filteredGroups, selectedItem]);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(favoriteStorageKey) || "{\"items\":[]}");
      setFavorites(Array.isArray(data.items) ? data.items : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 1500);
  }

  function saveFavorites(items: Favorite[]) {
    setFavorites(items);
    localStorage.setItem(favoriteStorageKey, JSON.stringify({ version: 1, items }));
  }

  function patch(next: Partial<GiveSnapshot>) {
    setSnapshot((current) => ({ ...current, ...next }));
  }

  function setField(field: string, value: GiveFieldValue) {
    setSnapshot((current) => ({ ...current, fields: { ...current.fields, [field]: value } }));
  }

  function field(field: string, fallback = "") {
    const value = snapshot.fields[field];
    return value === undefined || value === null ? fallback : String(value);
  }

  function checked(fieldName: string) {
    return snapshot.fields[fieldName] === true || snapshot.fields[fieldName] === "true";
  }

  function onItemChange(itemId: string) {
    let potionModifier = snapshot.potionModifier;
    if (isPotion(itemId)) {
      const mods = potionOptions(itemId);
      if ((potionModifier === "long" && !mods.hasLong) || (potionModifier === "strong" && !mods.hasStrong)) {
        potionModifier = "normal";
      }
    }
    patch({ itemId, potionModifier });
  }

  function resetAll() {
    if (!window.confirm("Сбросить все параметры?")) return;
    setQuery("");
    setSnapshot(defaultGiveSnapshot());
  }

  function copy(text = command) {
    if (text === "— выберите предмет —") return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("✓ Скопировано"))
      .catch(() => showToast("Не удалось скопировать"));
  }

  async function generateFromDescription() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      showToast("Опиши предмет словами");
      return;
    }
    setAiBusy(true);
    setAiNotes([]);
    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "give", prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Не получилось понять описание");
      setQuery("");
      setSnapshot({
        ...defaultGiveSnapshot(),
        ...data.snapshot,
        fields: { ...defaultGiveSnapshot().fields, ...(data.snapshot?.fields || {}) },
        explosions: data.snapshot?.explosions || [],
        shieldLayers: data.snapshot?.shieldLayers?.length ? data.snapshot.shieldLayers : [freshShieldLayer()],
      });
      setAiNotes([data.summary, ...(data.notes || [])].filter(Boolean));
      showToast("Описание применено");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не получилось понять описание");
    } finally {
      setAiBusy(false);
    }
  }

  function addFavorite() {
    const defaultName = ALL_ITEMS[selectedItem] || selectedItem || "Предмет";
    const name = window.prompt("Название?", defaultName);
    if (!name?.trim()) return;
    saveFavorites([...favorites, { ...snapshot, id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), version: 1, createdAt: Date.now(), _lastCmd: command }]);
    showToast("✓ Сохранено");
  }

  function loadFavorite(id: string) {
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite || !window.confirm(`Заменить текущие параметры на «${favorite.name}»?`)) return;
    setSnapshot({
      ...defaultGiveSnapshot(),
      ...favorite,
      fields: { ...defaultGiveSnapshot().fields, ...(favorite.fields || {}) },
      explosions: favorite.explosions || [],
      shieldLayers: favorite.shieldLayers?.length ? favorite.shieldLayers : [freshShieldLayer()],
    });
    showToast("✓ Загружено");
  }

  function renameFavorite(id: string) {
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite) return;
    const name = window.prompt("Новое название?", favorite.name);
    if (!name?.trim()) return;
    saveFavorites(favorites.map((item) => item.id === id ? { ...item, name: name.trim() } : item));
    showToast("✓ Переименовано");
  }

  function removeFavorite(id: string) {
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite || !window.confirm(`Удалить «${favorite.name}»?`)) return;
    saveFavorites(favorites.filter((item) => item.id !== id));
    showToast("✓ Удалено");
  }

  function randomizeGive() {
    const flat = itemGroups.flatMap((group) => group.items.map(([id]) => id));
    const itemId = pick(flat);
    const next = defaultGiveSnapshot();
    next.itemId = itemId;
    next.count = String(isPotion(itemId) || itemId === "firework_rocket" || FOOD_ITEMS.has(itemId) ? randInt(1, 16) : enchantsForItem(itemId).length || canHaveTrim(itemId) || itemId === "totem_of_undying" ? randInt(1, 3) : randInt(1, 64));
    if (chance(0.58)) {
      next.fields.name = pick(randomNames);
      next.fields["name-color"] = chance(0.75) ? pick(nameColors.slice(1))[0] : "";
      next.fields["name-bold"] = chance(0.28);
      next.fields["name-italic"] = chance(0.16);
    }
    for (let i = 0; i < (chance(0.5) ? randInt(1, 3) : 0); i++) {
      next.fields[`lore-${i}`] = pick(randomLore);
      next.fields[`lore-color-${i}`] = chance(0.65) ? pick(nameColors.slice(1))[0] : "";
    }
    enchantsForItem(itemId).sort(() => Math.random() - 0.5).slice(0, chance(0.68) ? randInt(1, 4) : 0).forEach((ench: { id: string; max: number }) => {
      next.fields[`ench-${ench.id}`] = true;
      next.fields[`enchlvl-${ench.id}`] = String(randInt(1, ench.max));
    });
    if (itemId.startsWith("leather_") && chance(0.85)) {
      next.fields["dye-on"] = true;
      next.fields["dye-color"] = pick(randomColors);
    }
    if (canHaveTrim(itemId) && chance(0.55)) {
      next.fields["trim-on"] = true;
      next.fields["trim-mat"] = pick(trimMaterials)[0];
      next.fields["trim-pat"] = pick(trimPatterns)[0];
    }
    if (itemId === "shield" && chance(0.82)) {
      next.fields["shield-on"] = true;
      next.fields["shield-base"] = pick(dyeColors)[0];
      next.shieldLayers = Array.from({ length: randInt(1, 5) }, () => freshShieldLayer(pick(bannerPatterns)[0], pick(dyeColors)[0]));
    }
    if (FOOD_ITEMS.has(itemId)) {
      next.fields["food-nutrition"] = String(randInt(1, 12));
      next.fields["food-saturation"] = (randInt(1, 80) / 10).toFixed(1);
      next.fields["food-always-eat"] = chance(0.35);
      ["speed", "regeneration", "strength", "resistance", "fire_resistance", "night_vision", "jump_boost"].slice(0, chance(0.48) ? randInt(1, 3) : 0).forEach((effect, i) => {
        next.fields[`food-eff-on-${i}`] = true;
        next.fields[`food-eff-${i}`] = effect;
        next.fields[`food-eff-amp-${i}`] = String(randInt(0, 2));
        next.fields[`food-eff-dur-${i}`] = String(pick([200, 600, 1200, 3600]));
        next.fields[`food-eff-prob-${i}`] = chance(0.75) ? "1.0" : (randInt(25, 85) / 100).toFixed(2);
      });
    }
    if (isPotion(itemId)) {
      next.potionType = pick(["potion", "splash_potion", "lingering_potion", "tipped_arrow"]);
      const mods = potionOptions(itemId);
      next.potionModifier = pick(["normal", ...(mods.hasLong ? ["long"] : []), ...(mods.hasStrong ? ["strong"] : [])]);
    }
    if (itemId === "firework_rocket") {
      next.fields["fw-duration"] = String(randInt(1, 3));
      next.explosions = Array.from({ length: randInt(1, 4) }, () => ({
        id: Date.now() + Math.random(),
        shape: pick(fireworkShapes)[0],
        colors: Array.from({ length: randInt(1, 3) }, () => pick(randomColors)),
        fadeColors: chance(0.55) ? Array.from({ length: randInt(1, 2) }, () => pick(randomColors)) : [],
        trail: chance(0.45),
        twinkle: chance(0.45),
      }));
    }
    if (itemId === "totem_of_undying" || chance(0.16)) {
      next.fields["totem-on"] = true;
      ["regeneration", "absorption", "fire_resistance"].forEach((effect, i) => {
        next.fields[`totem-eff-on-${i}`] = true;
        next.fields[`totem-eff-${i}`] = effect;
        next.fields[`totem-eff-amp-${i}`] = String(randInt(0, 2));
        next.fields[`totem-eff-dur-${i}`] = String(pick([200, 600, 900, 1200]));
      });
    }
    setQuery("");
    setSnapshot(next);
    showToast("Случайный предмет готов");
  }

  return (
    <>
      <section className="panel">
        <h2>Цель и предмет</h2>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <label>
            <span className="lab">Кому выдать</span>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8 }}>
              <select value={snapshot.target} onChange={(event) => patch({ target: event.target.value })}>
                <option value="@s">@s (себе)</option>
                <option value="@p">@p (ближайший)</option>
                <option value="@a">@a (всем)</option>
                <option value="@r">@r (случайный)</option>
              </select>
              <input type="text" value={snapshot.targetCustom} onChange={(event) => patch({ targetCustom: event.target.value })} placeholder="или свой селектор: @a[team=red]" />
            </div>
          </label>
          <label><span className="lab">Количество (1-64)</span><input type="number" min="1" max="64" value={snapshot.count} onChange={(event) => patch({ count: clampNumberInput(event.target.value, 1, 64, { integer: true }) })} /></label>
        </div>
        <label>
          <span className="lab">Предмет</span>
          <div className="item-picker">
            <input className="item-search" type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию (рус/англ)..." />
            <select value={selectedItem} onChange={(event) => onItemChange(event.target.value)}>
              {filteredGroups.map((group: { name: string; items: [string, string][] }) => (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map(([id, name]) => <option key={id} value={id}>{name} ({id})</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </label>
      </section>

      <section className="panel ai-panel">
        <h2>Собрать словами <span className="sub">AI-помощник</span></h2>
        <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Например: незеритовый меч на остроту V и добычу III с именем Дедов аргумент, или бросаемое зелье силы II" rows={3} />
        <div className="btn-row ai-actions">
          <button type="button" onClick={generateFromDescription} disabled={aiBusy}>{aiBusy ? "Думаю..." : "Понять описание"}</button>
          <button className="sec" type="button" onClick={() => setAiPrompt("")} disabled={aiBusy || !aiPrompt}>Очистить</button>
        </div>
        <p className="hint">Модель получает допустимые предметы, чары, зелья, эффекты, цвета, отделки и компоненты Minecraft 1.21.5. Сервер применяет только валидные поля.</p>
        {aiNotes.length ? <ul className="ai-notes">{aiNotes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul> : null}
      </section>

      <section className="panel">
        <div className="fav-header"><h2>Коллекция</h2><button className="small sec" type="button" onClick={addFavorite}>Сохранить</button></div>
        {favorites.length ? (
          <div className="favorites-grid">
            {favorites.map((item) => <div className="fav-card" key={item.id}>
              <div className="fav-name">{item.name}</div>
              <div className="fav-sub">{ALL_ITEMS[item.itemId] || item.itemId || "?"}</div>
              <div className="fav-actions">
                <button className="small" type="button" onClick={() => loadFavorite(item.id)}>Загрузить</button>
                <button className="small sec" type="button" onClick={() => renameFavorite(item.id)}>Имя</button>
                <button className="small info" type="button" onClick={() => copy(item._lastCmd || buildGiveCommand(item))}>Копия</button>
                <button className="small danger" type="button" onClick={() => removeFavorite(item.id)}>X</button>
              </div>
            </div>)}
          </div>
        ) : <p className="empty-favs">Пока пусто. Выбери предмет и нажми Сохранить</p>}
      </section>

      <section className="panel random-panel">
        <button className="random" type="button" onClick={randomizeGive}>Случайно</button>
        <span className="hint">Собрать случайный предмет с подходящим количеством, именем, лором, чарами и особыми компонентами.</span>
      </section>

      <section className="panel preview-panel give-preview-panel">
        <h2>Предпросмотр</h2>
        <GivePreview snapshot={snapshot} />
      </section>

      <section className="panel">
        <h2>Параметры предмета</h2>
        <div className="section">
          <div className="section-title">1. Имя и лор</div>
          <div className="grid-2" style={{ marginBottom: 8 }}>
            <label><span className="lab">Кастомное имя</span><input type="text" value={field("name")} onChange={(event) => setField("name", event.target.value)} placeholder="оставь пустым - без имени" /></label>
            <SelectField label="Цвет имени" value={field("name-color")} onChange={(value) => setField("name-color", value)} options={nameColors} />
          </div>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <CheckField label="Жирное" checked={checked("name-bold")} onChange={(value) => setField("name-bold", value)} />
            <CheckField label="Курсив" checked={checked("name-italic")} onChange={(value) => setField("name-italic", value)} />
          </div>
          <div className="section-title">Лор (до 5 строк)</div>
          {loreRows.map((i) => <div className="lore-row" key={i}>
            <input type="text" value={field(`lore-${i}`)} onChange={(event) => setField(`lore-${i}`, event.target.value)} placeholder={`Строка ${i + 1} лора`} />
            <select value={field(`lore-color-${i}`)} onChange={(event) => setField(`lore-color-${i}`, event.target.value)}>{nameColors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>)}
        </div>

        {enchants.length ? <div className="section"><div className="section-title">2. Зачарования</div><div className="enchant-list">
          {enchants.map((ench: { id: string; name: string; max: number }) => <div className="enchant-row" key={ench.id}>
            <CheckField label={`${ench.name} (${ench.max})`} checked={checked(`ench-${ench.id}`)} onChange={(value) => setField(`ench-${ench.id}`, value)} />
            <input type="number" min="1" max={ench.max} value={field(`enchlvl-${ench.id}`, String(ench.max))} onChange={(event) => setField(`enchlvl-${ench.id}`, clampNumberInput(event.target.value, 1, ench.max, { integer: true }))} />
          </div>)}
        </div></div> : null}

        {selectedItem.startsWith("leather_") ? <div className="section"><div className="section-title">3. Окраска (кожаная броня)</div><label className="check-row" style={{ gap: 10 }}>
          <input type="checkbox" checked={checked("dye-on")} onChange={(event) => setField("dye-on", event.target.checked)} /> Покрасить
          <input type="color" value={field("dye-color", "#a06540")} onChange={(event) => setField("dye-color", event.target.value)} style={{ width: 48, height: 26, padding: 0, border: "2px solid var(--border)", background: "var(--bg)", cursor: "pointer", marginLeft: 6 }} />
        </label></div> : null}

        {canHaveTrim(selectedItem) ? <div className="section"><div className="section-title">4. Отделка брони</div>
          <CheckField label="Включить отделку" checked={checked("trim-on")} onChange={(value) => setField("trim-on", value)} />
          <div className="grid-2">
            <SelectField label="Материал" value={field("trim-mat", "quartz")} onChange={(value) => setField("trim-mat", value)} options={trimMaterials} withId />
            <SelectField label="Узор" value={field("trim-pat", "sentry")} onChange={(value) => setField("trim-pat", value)} options={trimPatterns} withId />
          </div>
        </div> : null}

        {selectedItem === "shield" ? <div className="section"><div className="section-title">4. Узоры щита</div>
          <CheckField label="Включить узоры и цвет щита" checked={checked("shield-on")} onChange={(value) => setField("shield-on", value)} />
          {checked("shield-on") ? <div className="shield-card">
            <div className="grid-2">
              <SelectField label="Базовый цвет" value={field("shield-base", "white")} onChange={(value) => setField("shield-base", value)} options={dyeColors} withId />
              <ColorSwatches value={field("shield-base", "white")} onChange={(value) => setField("shield-base", value)} />
            </div>
            {snapshot.shieldLayers.map((layer, index) => <div className="shield-layer-row" key={layer.id}>
              <span className="shield-layer-num">{index + 1}</span>
              <SelectField label="Узор" value={layer.pattern} onChange={(value) => patch({ shieldLayers: snapshot.shieldLayers.map((item) => item.id === layer.id ? { ...item, pattern: value } : item) })} options={bannerPatterns} withId />
              <SelectField label="Цвет" value={layer.color} onChange={(value) => patch({ shieldLayers: snapshot.shieldLayers.map((item) => item.id === layer.id ? { ...item, color: value } : item) })} options={dyeColors} />
              <button className="small" type="button" disabled={index === 0} onClick={() => moveShieldLayer(layer.id, -1)}>↑</button>
              <button className="small" type="button" disabled={index === snapshot.shieldLayers.length - 1} onClick={() => moveShieldLayer(layer.id, 1)}>↓</button>
              <button className="small danger" type="button" onClick={() => patch({ shieldLayers: snapshot.shieldLayers.filter((item) => item.id !== layer.id) })}>X</button>
              <div style={{ gridColumn: "2 / -1" }}><ColorSwatches value={layer.color} onChange={(value) => patch({ shieldLayers: snapshot.shieldLayers.map((item) => item.id === layer.id ? { ...item, color: value } : item) })} /></div>
            </div>)}
            {snapshot.shieldLayers.length < 16 ? <button className="small info" type="button" onClick={() => patch({ shieldLayers: [...snapshot.shieldLayers, freshShieldLayer()] })}>+ Добавить слой</button> : null}
            <p className="hint">Слои идут сверху вниз как в ткацком станке. Доступны vanilla registry ID узоров из Java 1.21.5.</p>
          </div> : null}
        </div> : null}

        {FOOD_ITEMS.has(selectedItem) ? <FoodSection field={field} checked={checked} setField={setField} /> : null}
        <TotemSection field={field} checked={checked} setField={setField} />
        {selectedItem === "firework_rocket" ? <FireworkSection snapshot={snapshot} patch={patch} field={field} setField={setField} /> : null}
        {isPotion(selectedItem) ? <PotionSection snapshot={snapshot} patch={patch} mods={potionMods} /> : null}
      </section>

      <section className="panel output-panel">
        <h2>Готовая команда</h2>
        <div id="command-output">{command}</div>
        <div className={`char-count${longCommand ? " long" : ""}`}>Длина: {command.length} символов</div>
        <div className="btn-row">
          <button type="button" onClick={() => copy()}>Копировать</button>
          <button className="sec" type="button" onClick={() => setSnapshot({ ...snapshot })}>Обновить</button>
          <button className="danger" type="button" onClick={resetAll}>Сброс</button>
        </div>
        {longCommand ? <div className="warn">Команда длиннее 256 символов - используй командный блок: <code>/give @s command_block</code>{autoTarget ? ". Цель в команде автоматически заменена с @s на @p, чтобы командный блок выдал предмет ближайшему игроку." : ""}</div> : null}
      </section>
      <div id="toast" style={{ opacity: toast ? 1 : 0 }}>{toast}</div>
    </>
  );

  function moveShieldLayer(id: number, dir: number) {
    const layers = [...snapshot.shieldLayers];
    const index = layers.findIndex((item) => item.id === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= layers.length) return;
    [layers[index], layers[next]] = [layers[next], layers[index]];
    patch({ shieldLayers: layers });
  }
}

function SelectField({ label, value, onChange, options, withId = false }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string, string?])[]; withId?: boolean }) {
  return <label><span className="lab">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}{withId && id ? ` (${id})` : ""}</option>)}</select></label>;
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}

function GivePreview({ snapshot }: { snapshot: GiveSnapshot }) {
  const data = getGivePreviewData(snapshot);
  return <div id="give-preview" className="preview-card give-preview-card">
    <div className="give-preview-main">
      <div className="give-preview-icon" aria-hidden="true">{data.itemName.slice(0, 2).toUpperCase()}</div>
      <div>
        <div className="preview-top"><span className="preview-role">Итоговый предмет</span></div>
        <div className="preview-title">{data.customName || data.itemName}</div>
        <div className="preview-type">{data.itemName} <code>{data.itemId}</code></div>
      </div>
    </div>
    <div className="preview-chips">
      {[...data.chips, ...data.nameStyle].map((item) => <span key={item}>{item}</span>)}
    </div>
    {data.lore.length ? <ul className="give-preview-lore">{data.lore.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul> : null}
    {data.enchantments.length ? <div className="preview-effects"><span>Чары:</span> {data.enchantments.join(", ")}</div> : null}
    {data.sections.length ? <ul className="preview-gear give-preview-sections">
      {data.sections.map((section) => <li key={section.label}>
        <span>{section.label}</span>
        <strong>{section.value}</strong>
        {section.swatches?.length ? <em className="give-preview-swatches">{section.swatches.map((color, index) => <i key={`${section.label}-${color}-${index}`} style={{ background: color }} />)}</em> : null}
      </li>)}
    </ul> : <p className="preview-empty">Без дополнительных компонентов</p>}
  </div>;
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const entry = dyeColors.find(([id]) => id === value) || dyeColors[0];
  return <div className="shield-color-picker">
    <div className="shield-color-label">{entry[1]} ({entry[0]})</div>
    <div className="shield-swatches">{dyeColors.map(([id, name, hex]) => <button key={id} className={`shield-swatch${id === value ? " active" : ""}`} type="button" style={{ background: hex }} title={`${name} (${id})`} aria-label={name} onClick={() => onChange(id)} />)}</div>
  </div>;
}

function FoodSection({ field, checked, setField }: { field: (name: string, fallback?: string) => string; checked: (name: string) => boolean; setField: (name: string, value: GiveFieldValue) => void }) {
  return <div className="section"><div className="section-title">5. Параметры еды</div>
    <div className="grid-3" style={{ marginBottom: 10 }}>
      <label><span className="lab">Питательность (0-20)</span><input type="number" min="0" max="20" value={field("food-nutrition", "4")} onChange={(event) => setField("food-nutrition", clampNumberInput(event.target.value, 0, 20, { integer: true }))} /></label>
      <label><span className="lab">Насыщение (0.0-20.0)</span><input type="number" min="0" max="20" step="0.1" value={field("food-saturation", "0.6")} onChange={(event) => setField("food-saturation", clampNumberInput(event.target.value, 0, 20))} /></label>
      <CheckField label="Есть с полным голодом" checked={checked("food-always-eat")} onChange={(value) => setField("food-always-eat", value)} />
    </div>
    <div className="section-title">Эффекты при поедании (до 5)</div>
    {foodRows.map((i) => <div className="enchant-row give-effect-row" key={i}>
      <input type="checkbox" checked={checked(`food-eff-on-${i}`)} onChange={(event) => setField(`food-eff-on-${i}`, event.target.checked)} />
      <select value={field(`food-eff-${i}`, effects[0][0])} onChange={(event) => setField(`food-eff-${i}`, event.target.value)}>{effects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <input type="number" min="0" max="255" value={field(`food-eff-amp-${i}`, "0")} onChange={(event) => setField(`food-eff-amp-${i}`, clampNumberInput(event.target.value, 0, 255, { integer: true }))} title="Сила (0=I)" />
      <input type="number" min="1" max="1000000" value={field(`food-eff-dur-${i}`, "200")} onChange={(event) => setField(`food-eff-dur-${i}`, clampNumberInput(event.target.value, 1, 1000000, { integer: true }))} title="Длительность (тики)" />
      <input type="number" min="0" max="1" step="0.05" value={field(`food-eff-prob-${i}`, "1.0")} onChange={(event) => setField(`food-eff-prob-${i}`, clampNumberInput(event.target.value, 0, 1))} title="Шанс (0-1)" />
    </div>)}
    <p className="hint">Сила 0=I, длительность в тиках, шанс 0-1</p>
  </div>;
}

function TotemSection({ field, checked, setField }: { field: (name: string, fallback?: string) => string; checked: (name: string) => boolean; setField: (name: string, value: GiveFieldValue) => void }) {
  return <div className="section"><div className="section-title">6. Тотем бессмертия</div>
    <CheckField label="Действует как тотем" checked={checked("totem-on")} onChange={(value) => setField("totem-on", value)} />
    {checked("totem-on") ? <div>
      <p className="hint" style={{ marginBottom: 8 }}>Эффекты после срабатывания:</p>
      {totemRows.map((i) => <div className="enchant-row give-totem-row" key={i}>
        <input type="checkbox" checked={checked(`totem-eff-on-${i}`)} onChange={(event) => setField(`totem-eff-on-${i}`, event.target.checked)} />
        <select value={field(`totem-eff-${i}`, "regeneration")} onChange={(event) => setField(`totem-eff-${i}`, event.target.value)}>{effects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        <input type="number" min="0" max="255" value={field(`totem-eff-amp-${i}`, "0")} onChange={(event) => setField(`totem-eff-amp-${i}`, clampNumberInput(event.target.value, 0, 255, { integer: true }))} title="Сила (0=I)" />
        <input type="number" min="1" max="1000000" value={field(`totem-eff-dur-${i}`, "200")} onChange={(event) => setField(`totem-eff-dur-${i}`, clampNumberInput(event.target.value, 1, 1000000, { integer: true }))} title="Длительность (тики)" />
      </div>)}
    </div> : null}
  </div>;
}

function FireworkSection({ snapshot, patch, field, setField }: { snapshot: GiveSnapshot; patch: (next: Partial<GiveSnapshot>) => void; field: (name: string, fallback?: string) => string; setField: (name: string, value: GiveFieldValue) => void }) {
  function updateExplosion(id: number, next: Partial<Explosion>) {
    patch({ explosions: snapshot.explosions.map((item) => item.id === id ? { ...item, ...next } : item) });
  }
  return <div className="section"><div className="section-title">7. Фейерверк</div>
    <label style={{ marginBottom: 12, maxWidth: 220 }}><span className="lab">Длительность полёта</span><select value={field("fw-duration", "1")} onChange={(event) => setField("fw-duration", event.target.value)}><option value="1">1 - короткий</option><option value="2">2 - средний</option><option value="3">3 - долгий</option></select></label>
    {snapshot.explosions.map((exp, index) => <div className="explosion-card" key={exp.id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span className="slot-title">Взрыв {index + 1}</span><button className="small danger" type="button" onClick={() => patch({ explosions: snapshot.explosions.filter((item) => item.id !== exp.id) })}>Удалить</button></div>
      <div className="grid-2" style={{ marginBottom: 8 }}>
        <SelectField label="Форма" value={exp.shape} onChange={(value) => updateExplosion(exp.id, { shape: value })} options={fireworkShapes} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 18 }}>
          <CheckField label="След" checked={exp.trail} onChange={(value) => updateExplosion(exp.id, { trail: value })} />
          <CheckField label="Мерцание" checked={exp.twinkle} onChange={(value) => updateExplosion(exp.id, { twinkle: value })} />
        </div>
      </div>
      <ColorList title="Основные цвета" colors={exp.colors} onChange={(colors) => updateExplosion(exp.id, { colors })} />
      <ColorList title="Цвета затухания" colors={exp.fadeColors} onChange={(fadeColors) => updateExplosion(exp.id, { fadeColors })} />
    </div>)}
    {snapshot.explosions.length < 8 ? <button className="info" type="button" onClick={() => patch({ explosions: [...snapshot.explosions, freshExplosion()] })}>+ Добавить взрыв</button> : null}
  </div>;
}

function ColorList({ title, colors, onChange }: { title: string; colors: string[]; onChange: (colors: string[]) => void }) {
  return <div style={{ marginBottom: 8 }}>
    <div className="section-title" style={{ fontSize: 8, marginBottom: 4 }}>{title}</div>
    <div className="colors-row">{colors.map((color, index) => <span className="color-entry" key={`${color}-${index}`}><input type="color" value={color} onChange={(event) => onChange(colors.map((item, i) => i === index ? event.target.value : item))} /><button className="small danger" type="button" onClick={() => onChange(colors.filter((_, i) => i !== index))}>X</button></span>)}</div>
    {colors.length < 8 ? <button className="small info" type="button" onClick={() => onChange([...colors, "#ffffff"])}>+ Цвет</button> : null}
  </div>;
}

function PotionSection({ snapshot, patch, mods }: { snapshot: GiveSnapshot; patch: (next: Partial<GiveSnapshot>) => void; mods: { hasLong: boolean; hasStrong: boolean } }) {
  return <div className="section"><div className="section-title">8. Параметры зелья</div><div className="grid-2">
    <div><span className="lab">Тип</span><div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      {[["potion", "Обычное"], ["splash_potion", "Бросаемое"], ["lingering_potion", "Длительное"], ["tipped_arrow", "Зачарованная стрела"]].map(([id, label]) => <label className="check-row" key={id}><input type="radio" name="potion-type" checked={snapshot.potionType === id} onChange={() => patch({ potionType: id })} /> {label}</label>)}
    </div></div>
    <div><span className="lab">Мощность</span><div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      <label className="check-row"><input type="radio" name="potion-modifier" checked={snapshot.potionModifier === "normal"} onChange={() => patch({ potionModifier: "normal" })} /> Обычное</label>
      {mods.hasLong ? <label className="check-row"><input type="radio" name="potion-modifier" checked={snapshot.potionModifier === "long"} onChange={() => patch({ potionModifier: "long" })} /> Продлённое</label> : null}
      {mods.hasStrong ? <label className="check-row"><input type="radio" name="potion-modifier" checked={snapshot.potionModifier === "strong"} onChange={() => patch({ potionModifier: "strong" })} /> Усиленное II</label> : null}
    </div></div>
  </div></div>;
}
