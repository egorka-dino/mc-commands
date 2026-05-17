"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_MOBS,
  BANNER_PATTERNS,
  canHaveTrim,
  DYE_COLORS,
  EFFECTS,
  enchantsForItem,
  isFireball,
  isShield,
  ITEM_NAMES,
  MOB_GROUPS,
  NAME_COLORS,
  RANDOM_BABY_MOBS,
  RANDOM_MOBS,
  RANDOM_NAMES,
  SLOTS,
  TRIM_MATERIALS,
  TRIM_PATTERNS,
  type SummonFieldValue,
  type SummonSnapshot,
  type SummonTemplateLike,
} from "./data";
import { buildSummonCommand, getPreviewData, normalizeSnapshot, toSnapshot } from "./engine";

type Favorite = SummonSnapshot & {
  id: string;
  name: string;
  version: number;
  createdAt: number;
};

type Props = {
  adminMode?: boolean;
  showAiAssistant?: boolean;
  initialSnapshot?: SummonSnapshot;
  templates?: SummonTemplateLike[];
  onSnapshotChange?: (snapshot: SummonSnapshot) => void;
};

const favoriteStorageKey = "mc-summon:favorites";

function fieldKey(index: number, field: string) {
  return `${index}-${field}`;
}

function read(snapshot: SummonSnapshot, index: number, field: string) {
  const value = snapshot.fields[fieldKey(index, field)];
  return value === undefined || value === null ? "" : String(value);
}

function checked(snapshot: SummonSnapshot, index: number, field: string) {
  const value = snapshot.fields[fieldKey(index, field)];
  return value === true || value === "true";
}

function clampNumberInput(value: string, min: number, max: number, options: { integer?: boolean; allowEmpty?: boolean } = {}) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized && options.allowEmpty) return "";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return String(min);
  const clamped = Math.min(max, Math.max(min, options.integer ? Math.trunc(parsed) : parsed));
  return String(clamped);
}

function setIndexedField(snapshot: SummonSnapshot, index: number, field: string, value: SummonFieldValue) {
  const fields = { ...snapshot.fields, [fieldKey(index, field)]: value };
  const mobOrder = snapshot.mobOrder.map((mob, mobIndex) =>
    mobIndex === index && field === "mob" ? { mobType: String(value || "zombie") } : mob,
  );
  return normalizeSnapshot({ mobOrder, fields });
}

function reindexWithout(snapshot: SummonSnapshot, removeIndex: number) {
  const fields: Record<string, SummonFieldValue> = {};
  Object.entries(snapshot.fields).forEach(([key, value]) => {
    const match = key.match(/^(\d+)-(.+)$/);
    if (!match) return;
    const oldIndex = Number.parseInt(match[1], 10);
    if (oldIndex === removeIndex) return;
    const nextIndex = oldIndex > removeIndex ? oldIndex - 1 : oldIndex;
    fields[`${nextIndex}-${match[2]}`] = value;
  });
  return normalizeSnapshot({
    mobOrder: snapshot.mobOrder.filter((_, index) => index !== removeIndex),
    fields,
  });
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number) {
  return Math.random() < p;
}

function pick<T>(list: readonly T[]): T {
  return list[randomInt(0, list.length - 1)];
}

function randomStat(min: number, max: number, step: number) {
  const steps = Math.round((max - min) / step);
  return (min + randomInt(0, steps) * step).toFixed(step < 1 ? 2 : 0).replace(/\.?0+$/, "");
}

function makeRandomSnapshot() {
  const passengerCount = chance(0.55) ? randomInt(1, chance(0.25) ? 3 : 2) : 0;
  let snapshot = toSnapshot(Array.from({ length: passengerCount + 1 }, () => "zombie"));

  snapshot.mobOrder.forEach((_, index) => {
    const mobType = pick(RANDOM_MOBS);
    snapshot = setIndexedField(snapshot, index, "mob", mobType);
    const fields: Array<[string, SummonFieldValue]> = [
      ["name", chance(0.45) ? pick(RANDOM_NAMES) : ""],
      ["name-color", chance(0.7) ? pick(NAME_COLORS.slice(1))[0] : ""],
      ["name-bold", chance(0.25)],
      ["name-italic", chance(0.12)],
      ["name-visible", chance(0.8)],
      ["health", chance(0.62) ? randomInt(10, index === 0 ? 160 : 80) : ""],
      ["speed", chance(0.32) ? randomStat(0.15, 0.6, 0.05) : ""],
      ["armor", chance(0.35) ? randomInt(2, 24) : ""],
      ["attack", chance(0.42) ? randomStat(2, 24, 0.5) : ""],
      ["kb", chance(0.28) ? randomStat(0.1, 1, 0.1) : ""],
      ["scale", chance(0.42) ? randomStat(0.5, 3, 0.5) : ""],
      ["baby", RANDOM_BABY_MOBS.has(mobType) && chance(0.2)],
      ["invul", chance(0.06)],
      ["silent", chance(0.12)],
      ["noai", chance(0.05)],
      ["noburn", chance(0.22)],
      ["onfire", chance(0.08)],
      ["glow", chance(0.24)],
      ["nogravity", chance(0.05)],
      ["persist", true],
      ["nobreath", chance(0.12)],
      ["boss", index === 0 && chance(0.18)],
    ];
    fields.forEach(([field, value]) => {
      snapshot = setIndexedField(snapshot, index, field, value);
    });

    const gearChance = ["zombie", "husk", "drowned", "skeleton", "stray", "wither_skeleton", "bogged", "piglin", "piglin_brute", "zombified_piglin", "vindicator", "pillager"].includes(mobType) ? 0.78 : 0.32;
    if (chance(gearChance)) {
      SLOTS.forEach((slot) => {
        const slotChance = slot.key === "mainhand" ? 0.72 : slot.key === "offhand" ? 0.25 : 0.45;
        if (!chance(slotChance)) return;
        const itemId = pick(slot.items);
        snapshot = setIndexedField(snapshot, index, `slot-${slot.key}`, itemId);
        snapshot = setIndexedField(snapshot, index, `count-${slot.key}`, slot.key.includes("hand") && chance(0.12) ? randomInt(2, 8) : 1);
        snapshot = setIndexedField(snapshot, index, `drop-${slot.key}`, chance(0.18) ? randomStat(0.1, 1, 0.1) : 0);
        if (itemId.startsWith("leather_") && chance(0.65)) {
          snapshot = setIndexedField(snapshot, index, `dyeon-${slot.key}`, true);
          snapshot = setIndexedField(snapshot, index, `dye-${slot.key}`, pick(["#6ab04c", "#ffb347", "#8ab4f8", "#e55a5a", "#9b59b6", "#f1c40f"]));
        }
        if (canHaveTrim(itemId) && chance(0.3)) {
          snapshot = setIndexedField(snapshot, index, `trimon-${slot.key}`, true);
          snapshot = setIndexedField(snapshot, index, `trimmat-${slot.key}`, pick(TRIM_MATERIALS)[0]);
          snapshot = setIndexedField(snapshot, index, `trimpat-${slot.key}`, pick(TRIM_PATTERNS)[0]);
        }
        if (isShield(itemId) && chance(0.7)) {
          snapshot = setIndexedField(snapshot, index, `shieldon-${slot.key}`, true);
          snapshot = setIndexedField(snapshot, index, `shieldbase-${slot.key}`, pick(DYE_COLORS)[0]);
          const layerCount = randomInt(1, 4);
          for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
            snapshot = setIndexedField(snapshot, index, `shieldpat-${slot.key}-${layerIndex}`, pick(BANNER_PATTERNS)[0]);
            snapshot = setIndexedField(snapshot, index, `shieldcolor-${slot.key}-${layerIndex}`, pick(DYE_COLORS)[0]);
          }
        }
        enchantsForItem(itemId).filter(() => chance(0.24)).slice(0, randomInt(1, 3)).forEach((enchant) => {
          snapshot = setIndexedField(snapshot, index, `ench-${slot.key}-${enchant.id}`, true);
          snapshot = setIndexedField(snapshot, index, `enchlvl-${slot.key}-${enchant.id}`, randomInt(1, enchant.max));
        });
      });
    }

    const effectPool = ["speed", "strength", "resistance", "fire_resistance", "regeneration", "jump_boost", "glowing", "slow_falling", "invisibility", "health_boost"];
    const chosen = new Set<string>();
    const count = chance(0.55) ? randomInt(1, 3) : 0;
    while (chosen.size < count) chosen.add(pick(effectPool));
    chosen.forEach((effectId) => {
      snapshot = setIndexedField(snapshot, index, `eff-${effectId}`, true);
      snapshot = setIndexedField(snapshot, index, `effamp-${effectId}`, randomInt(0, 2));
      snapshot = setIndexedField(snapshot, index, `effdur-${effectId}`, pick([1200, 3600, 12000, 999999]));
    });
  });

  return snapshot;
}

export function SummonEditor({ adminMode = false, showAiAssistant = false, initialSnapshot, templates, onSnapshotChange }: Props) {
  const [snapshot, setSnapshot] = useState(() => normalizeSnapshot(initialSnapshot || toSnapshot(["zombie"])));
  const [coords, setCoords] = useState("~ ~ ~");
  const [presetId, setPresetId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [toast, setToast] = useState("");
  const command = useMemo(() => buildSummonCommand(snapshot, coords), [snapshot, coords]);
  const presets: SummonTemplateLike[] = templates || [];
  const shouldShowAiAssistant = !adminMode || showAiAssistant;

  useEffect(() => {
    if (initialSnapshot) setSnapshot(normalizeSnapshot(initialSnapshot));
  }, [initialSnapshot]);

  useEffect(() => {
    if (adminMode) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(favoriteStorageKey) || "{\"items\":[]}");
      setFavorites(Array.isArray(parsed.items) ? parsed.items : []);
    } catch {
      setFavorites([]);
    }
  }, [adminMode]);

  function updateSnapshot(next: SummonSnapshot) {
    const normalized = normalizeSnapshot(next);
    setSnapshot(normalized);
    onSnapshotChange?.(normalized);
  }

  function updateField(index: number, field: string, value: SummonFieldValue) {
    updateSnapshot(setIndexedField(snapshot, index, field, value));
  }

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 1500);
  }

  function saveFavorites(next: Favorite[]) {
    setFavorites(next);
    localStorage.setItem(favoriteStorageKey, JSON.stringify({ version: 1, items: next }));
  }

  function addFavorite() {
    const defaultName = ALL_MOBS[snapshot.mobOrder[0]?.mobType] || snapshot.mobOrder[0]?.mobType || "Моб";
    const name = window.prompt("Название любимчика?", defaultName);
    if (!name?.trim()) return;
    saveFavorites([...favorites, { ...snapshot, id: `fav-${Date.now()}`, name: name.trim(), version: 1, createdAt: Date.now() }]);
    showToast("Сохранено");
  }

  function renameFavorite(id: string) {
    const favorite = favorites.find((item) => item.id === id);
    if (!favorite) return;
    const name = window.prompt("Новое название?", favorite.name);
    if (!name?.trim()) return;
    saveFavorites(favorites.map((item) => item.id === id ? { ...item, name: name.trim() } : item));
    showToast("Переименовано");
  }

  function copy(text = command) {
    navigator.clipboard.writeText(text).then(() => showToast("Скопировано"));
  }

  async function generateFromDescription() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      showToast("Опиши моба словами");
      return;
    }
    setAiBusy(true);
    setAiNotes([]);
    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "summon", prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Не получилось понять описание");
      updateSnapshot(data.snapshot);
      setPresetId("");
      setAiNotes([data.summary, ...(data.notes || [])].filter(Boolean));
      showToast("Описание применено");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не получилось понять описание");
    } finally {
      setAiBusy(false);
    }
  }

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    updateSnapshot({ mobOrder: preset.mobOrder, fields: preset.fields });
    showToast("Шаблон загружен");
  }

  const selectedPreset = presets.find((item) => item.id === presetId);

  return (
    <div className="summon-app">
      {!adminMode ? (
        <section className="panel">
          <h2>Координаты</h2>
          <label><span className="lab">Где заспавнить</span><input type="text" value={coords} onChange={(event) => setCoords(event.target.value)} placeholder="~ ~ ~" /></label>
          <p className="hint">~ ~ ~ — на месте игрока. ~ ~1 ~ — на 1 блок выше. Точные координаты: 100 64 -200.</p>
        </section>
      ) : null}

      {!adminMode ? (
        <section className="panel">
          <h2>Шаблоны мобов <span className="sub">общие для всех</span></h2>
          <div className="preset-picker">
            <label><span className="lab">Выбери шаблон</span>
              <select disabled={!presets.length} value={presetId} onChange={(event) => applyPreset(event.target.value)}>
                <option value="">— выбери готового моба —</option>
                {[...new Set(presets.map((preset) => preset.category))].map((category) => (
                  <optgroup label={category} key={category}>
                    {presets.filter((preset) => preset.category === category && preset.enabled !== false).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="preset-description">
              {selectedPreset ? <><strong>{selectedPreset.name}</strong><span>{selectedPreset.description}</span><code>{selectedPreset.mobOrder.map((mob) => ALL_MOBS[mob.mobType] || mob.mobType).join(" -> ")}</code></> : presets.length ? <span>Шаблон сразу заменит текущего моба и пассажиров.</span> : <span>Пока нет общих шаблонов.</span>}
            </div>
          </div>
        </section>
      ) : null}

      {shouldShowAiAssistant ? (
        <section className="panel ai-panel">
          <h2>{adminMode ? "Собрать шаблон словами" : "Собрать словами"} <span className="sub">AI-помощник</span></h2>
          <textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder={adminMode ? "Например: скелет-наездник на пауке, оба светятся, скелет с луком на силу V и шлемом из золота" : "Например: зомби в незеритке с усталостью копания пятого уровня, мечом на остроту V и курицей-пассажиром"} rows={3} />
          <div className="btn-row ai-actions">
            <button type="button" onClick={generateFromDescription} disabled={aiBusy}>{aiBusy ? "Думаю..." : "Понять описание"}</button>
            <button className="sec" type="button" onClick={() => setAiPrompt("")} disabled={aiBusy || !aiPrompt}>Очистить</button>
          </div>
          <p className="hint">{adminMode ? "Помощник заполнит поля текущего шаблона. Метаданные шаблона — ID, название, категорию и описание — сохрани отдельно." : "Модель получает списки мобов, предметов, эффектов, чар, слотов и правил этого генератора. Неизвестные ID сервер отбрасывает."}</p>
          {aiNotes.length ? <ul className="ai-notes">{aiNotes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul> : null}
        </section>
      ) : null}

      {!adminMode ? (
        <section className="panel">
          <div className="fav-header"><h2>Коллекция любимчиков</h2><button className="small sec" type="button" onClick={addFavorite}>Сохранить текущего</button></div>
          {favorites.length ? <div className="favorites-grid">{favorites.map((favorite) => <div className="fav-card" key={favorite.id}><div className="fav-name">{favorite.name}</div><div className="fav-sub">{ALL_MOBS[favorite.mobOrder[0]?.mobType] || favorite.mobOrder[0]?.mobType}</div><div className="fav-actions"><button className="small" type="button" onClick={() => updateSnapshot(favorite)}>Загрузить</button><button className="small sec" type="button" onClick={() => renameFavorite(favorite.id)}>Переименовать</button><button className="small info" type="button" onClick={() => copy(buildSummonCommand(favorite))}>Копировать</button><button className="small danger" type="button" onClick={() => saveFavorites(favorites.filter((item) => item.id !== favorite.id))}>Удалить</button></div></div>)}</div> : <p className="empty-favs">Пока пусто. Настрой моба и нажми “Сохранить текущего”.</p>}
        </section>
      ) : null}

      {!adminMode ? (
        <section className="panel random-panel">
          <button className="random" type="button" onClick={() => { setPresetId(""); updateSnapshot(makeRandomSnapshot()); showToast("Случайный моб готов"); }}>Случайно</button>
          <span className="hint">Собрать случайного моба с характеристиками, снаряжением, эффектами и пассажирами.</span>
        </section>
      ) : null}

      <section className="panel">
        <h2>Мобы <span className="sub">основной + пассажиры (верхом)</span></h2>
        {snapshot.mobOrder.map((mob, index) => <MobCard key={index} index={index} snapshot={snapshot} updateField={updateField} removeMob={() => updateSnapshot(reindexWithout(snapshot, index))} />)}
        <div className="passenger-controls"><button className="info" type="button" onClick={() => updateSnapshot({ mobOrder: [...snapshot.mobOrder, { mobType: "zombie" }], fields: { ...snapshot.fields, [fieldKey(snapshot.mobOrder.length, "mob")]: "zombie", [fieldKey(snapshot.mobOrder.length, "persist")]: true, [fieldKey(snapshot.mobOrder.length, "name-visible")]: true } })}>+ Добавить пассажира</button><span className="hint">Первый пассажир сидит на основном, второй на первом, и т.д.</span></div>
      </section>

      <section className="panel preview-panel"><h2>Предпросмотр</h2><Preview snapshot={snapshot} /></section>

      {!adminMode ? (
        <section className="panel output-panel">
          <h2>Готовая команда</h2>
          <div id="command-output">{command}</div>
          <div className={`char-count${command.length > 256 ? " long" : ""}`}>Длина: {command.length} символов</div>
          <div className="btn-row"><button type="button" onClick={() => copy()}>Копировать</button><button className="sec" type="button" onClick={() => showToast("Обновлено")}>Обновить</button><button className="danger" type="button" onClick={() => { if (window.confirm("Сбросить все настройки и пассажиров?")) updateSnapshot(toSnapshot(["zombie"])); }}>Сброс всего</button></div>
          {command.length > 256 ? <div className="warn">Команда длиннее 256 символов — в чат не поместится. Используй командный блок.</div> : null}
        </section>
      ) : null}
      <div id="toast" style={{ opacity: toast ? 1 : 0 }}>{toast}</div>
    </div>
  );
}

function MobCard({ index, snapshot, updateField, removeMob }: { index: number; snapshot: SummonSnapshot; updateField: (index: number, field: string, value: SummonFieldValue) => void; removeMob: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobSearch, setMobSearch] = useState("");
  const [bossInfoOpen, setBossInfoOpen] = useState(false);
  const mobType = snapshot.mobOrder[index]?.mobType || "zombie";
  const isMain = index === 0;
  const levelLabel = isMain ? "ОСНОВНОЙ" : `ПАССАЖИР №${index}`;
  const stackInfo = isMain ? "снизу" : index === 1 ? "на основном" : `на пассажире №${index - 1}`;
  const input = (field: string) => ({ value: read(snapshot, index, field), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => updateField(index, field, event.target.value) });
  const numberInput = (field: string, min: number, max: number) => ({
    value: read(snapshot, index, field),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateField(index, field, clampNumberInput(event.target.value, min, max, { allowEmpty: true })),
  });
  const check = (field: string) => ({ checked: checked(snapshot, index, field), onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateField(index, field, event.target.checked) });
  const mobQuery = mobSearch.trim().toLowerCase();
  const filteredMobGroups = MOB_GROUPS.map((group) => ({
    ...group,
    mobs: group.mobs.filter(([id, name]) => !mobQuery || id.toLowerCase().includes(mobQuery) || name.toLowerCase().includes(mobQuery)),
  })).filter((group) => group.mobs.length > 0);

  return <div className={`mob-card ${isMain ? "main" : "passenger"}${collapsed ? " collapsed" : ""}`}>
    <div className="mob-head" onClick={() => setCollapsed(!collapsed)}><span className="lvl-badge">{levelLabel}</span><span className="mob-title">{ALL_MOBS[mobType] || mobType} <small>{stackInfo}</small></span>{!isMain ? <button className="small danger" type="button" onClick={(event) => { event.stopPropagation(); removeMob(); }}>Удалить</button> : null}<span className="arrow">▼</span></div>
    <div className="mob-body">
      <div className="section"><div className="section-title">1. Моб и имя</div><div className="grid-2">
        <label><span className="lab">Вид моба</span><div className="mob-picker"><input className="mob-search" type="text" value={mobSearch} onChange={(event) => setMobSearch(event.target.value)} placeholder="Поиск по названию (рус/англ)..." /><select {...input("mob")}>{filteredMobGroups.map((group) => <optgroup label={group.name} key={group.name}>{group.mobs.map(([id, name]) => <option key={id} value={id}>{name} ({id})</option>)}</optgroup>)}</select></div></label>
        <label><span className="lab">Имя</span><input type="text" {...input("name")} placeholder="например: Босс" /></label>
        <label><span className="lab">Цвет имени</span><select {...input("name-color")}>{NAME_COLORS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      </div><div className="grid-3" style={{ marginTop: 8 }}><label className="check-row"><input type="checkbox" {...check("name-bold")} /> Жирное</label><label className="check-row"><input type="checkbox" {...check("name-italic")} /> Курсив</label><label className="check-row"><input type="checkbox" {...check("name-visible")} /> Всегда видно</label></div></div>

      <div className="section"><div className="section-title">2. Характеристики</div><div className="grid-3">{[
        ["health", "HP (1-1024)", 1, 1024],
        ["speed", "Скорость (0-2)", 0, 2],
        ["armor", "Броня (0-30)", 0, 30],
        ["attack", "Урон атаки", 0, 2048],
        ["kb", "Сопр. отбрасыв.", 0, 1],
        ["scale", "Масштаб", 0.0625, 16],
      ].map(([field, label, min, max]) => <label key={String(field)}><span className="lab">{label}</span><input type="number" min={Number(min)} max={Number(max)} {...numberInput(String(field), Number(min), Number(max))} placeholder="по умолч." /></label>)}</div></div>

      {isFireball(mobType) ? <div className="section fireball-section"><div className="section-title">Фаерболл</div><div className="grid-3">{[
        ["power-x", "Power X", "0.0", -1000000, 1000000],
        ["power-y", "Power Y", "0.0", -1000000, 1000000],
        ["power-z", "Power Z", "1.0", -1000000, 1000000],
        ["explosion-power", "Мощность взрыва", "1", 0, 255],
      ].map(([field, label, placeholder, min, max]) => <label key={String(field)}><span className="lab">{label}</span><input type="number" min={Number(min)} max={Number(max)} {...numberInput(String(field), Number(min), Number(max))} placeholder={String(placeholder)} /></label>)}</div></div> : null}

      <div className="section"><div className="section-title">3. Особенности</div><div className="grid-3">{[["baby", "Ребёнок"], ["invul", "Неуязвимый"], ["invisible", "Невидимый"], ["silent", "Бесшумный"], ["noai", "Без ИИ"], ["noburn", "Не горит на солнце"], ["onfire", "Постоянно горит"], ["glow", "Светится контуром"], ["nogravity", "Без гравитации"], ["persist", "Не исчезает"], ["nobreath", "Не задыхается"]].map(([field, label]) => <label className="check-row" key={field}><input type="checkbox" {...check(field)} /> {label}</label>)}<label className="check-row boss-toggle"><input type="checkbox" {...check("boss")} /> Босс <button type="button" className="info-dot" aria-expanded={bossInfoOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setBossInfoOpen(!bossInfoOpen); }}>i</button></label>{bossInfoOpen ? <div className="boss-info">Галочка добавляет мобу тег <code>boss</code>. Чтобы на сервере появилась bossbar, установи мод <a href="https://github.com/egorka-dino/minecraft-mod-mob-bossbar/releases/" target="_blank" rel="noopener noreferrer">minecraft-mod-mob-bossbar</a> на сервер.</div> : null}</div></div>

      <div className="section"><div className="section-title">4. Снаряжение и зачарования</div>{SLOTS.map((slot) => <SlotEditor key={slot.key} index={index} slot={slot} snapshot={snapshot} updateField={updateField} />)}</div>
      <div className="section"><div className="section-title">5. Эффекты зелий</div><details><summary>Открыть список эффектов</summary><div className="enchant-list">{EFFECTS.map(([id, name]) => <div className="enchant-row" style={{ gridTemplateColumns: "1fr 50px 70px" }} key={id}><label><input type="checkbox" {...check(`eff-${id}`)} /> {name}</label><input type="number" min="0" max="255" value={read(snapshot, index, `effamp-${id}`) || "0"} onChange={(event) => updateField(index, `effamp-${id}`, clampNumberInput(event.target.value, 0, 255, { integer: true }))} /><input type="number" min="1" max="1000000" value={read(snapshot, index, `effdur-${id}`) || "999999"} onChange={(event) => updateField(index, `effdur-${id}`, clampNumberInput(event.target.value, 1, 1000000, { integer: true }))} /></div>)}</div></details></div>
    </div>
  </div>;
}

function ShieldColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = DYE_COLORS.find(([id]) => id === value) || DYE_COLORS[0];
  return <div className="shield-color-picker"><div className="shield-color-name">{selected[1]} ({selected[0]})</div><div className="shield-color-swatches">{DYE_COLORS.map(([id, name, hex]) => <button className={`shield-color-swatch${id === value ? " active" : ""}`} style={{ backgroundColor: hex }} title={`${name} (${id})`} aria-label={name} type="button" key={id} onClick={() => onChange(id)} />)}</div></div>;
}

function SlotEditor({ index, slot, snapshot, updateField }: { index: number; slot: (typeof SLOTS)[number]; snapshot: SummonSnapshot; updateField: (index: number, field: string, value: SummonFieldValue) => void }) {
  const itemId = read(snapshot, index, `slot-${slot.key}`);
  const enchants = enchantsForItem(itemId);
  const shieldLayers = Array.from({ length: 16 }, (_, layerIndex) => ({
    layerIndex,
    pattern: read(snapshot, index, `shieldpat-${slot.key}-${layerIndex}`),
  }));
  const visibleShieldLayers = shieldLayers.filter((layer) => layer.pattern);
  const nextShieldLayer = shieldLayers.find((layer) => !layer.pattern)?.layerIndex;
  const addShieldLayer = () => {
    if (nextShieldLayer === undefined) return;
    updateField(index, `shieldpat-${slot.key}-${nextShieldLayer}`, "stripe_center");
  };
  return <div className="slot"><div className="slot-title">{slot.label}</div><div className="slot-grid"><label><span className="lab">Предмет</span><select className="slot-item" value={itemId} onChange={(event) => updateField(index, `slot-${slot.key}`, event.target.value)}><option value="">— пусто —</option>{slot.items.map((item) => <option key={item} value={item}>{ITEM_NAMES[item as keyof typeof ITEM_NAMES] || item}</option>)}</select></label><label><span className="lab">Кол-во</span><input type="number" min="1" max="99" value={read(snapshot, index, `count-${slot.key}`) || "1"} onChange={(event) => updateField(index, `count-${slot.key}`, clampNumberInput(event.target.value, 1, 99, { integer: true }))} /></label><label><span className="lab">Шанс выпадения</span><input type="number" min="0" max="1" step="0.1" value={read(snapshot, index, `drop-${slot.key}`) || "0"} onChange={(event) => updateField(index, `drop-${slot.key}`, clampNumberInput(event.target.value, 0, 1))} /></label></div>{itemId.startsWith("leather_") ? <label className="check-row"><input type="checkbox" checked={checked(snapshot, index, `dyeon-${slot.key}`)} onChange={(event) => updateField(index, `dyeon-${slot.key}`, event.target.checked)} /> Покрасить кожу <input type="color" value={read(snapshot, index, `dye-${slot.key}`) || "#a06540"} onChange={(event) => updateField(index, `dye-${slot.key}`, event.target.value)} /></label> : null}{canHaveTrim(itemId) ? <div className="trim-picker"><label className="check-row"><input type="checkbox" checked={checked(snapshot, index, `trimon-${slot.key}`)} onChange={(event) => updateField(index, `trimon-${slot.key}`, event.target.checked)} /> Отделка брони</label><div className="grid-2"><select value={read(snapshot, index, `trimmat-${slot.key}`) || "iron"} onChange={(event) => updateField(index, `trimmat-${slot.key}`, event.target.value)}>{TRIM_MATERIALS.map(([value, name]) => <option key={value} value={value}>{name} ({value})</option>)}</select><select value={read(snapshot, index, `trimpat-${slot.key}`) || "sentry"} onChange={(event) => updateField(index, `trimpat-${slot.key}`, event.target.value)}>{TRIM_PATTERNS.map(([value, name]) => <option key={value} value={value}>{name} ({value})</option>)}</select></div></div> : null}{isShield(itemId) ? <div className="shield-picker"><label className="check-row"><input type="checkbox" checked={checked(snapshot, index, `shieldon-${slot.key}`)} onChange={(event) => updateField(index, `shieldon-${slot.key}`, event.target.checked)} /> Узоры щита</label>{checked(snapshot, index, `shieldon-${slot.key}`) ? <><label><span className="lab">Базовый цвет</span><select value={read(snapshot, index, `shieldbase-${slot.key}`) || "white"} onChange={(event) => updateField(index, `shieldbase-${slot.key}`, event.target.value)}>{DYE_COLORS.map(([value, name]) => <option key={value} value={value}>{name} ({value})</option>)}</select></label><ShieldColorPicker value={read(snapshot, index, `shieldbase-${slot.key}`) || "white"} onChange={(value) => updateField(index, `shieldbase-${slot.key}`, value)} /><div className="shield-layers">{visibleShieldLayers.map(({ layerIndex }) => <div className="shield-layer" key={layerIndex}><span className="shield-layer-index">{layerIndex + 1}</span><select value={read(snapshot, index, `shieldpat-${slot.key}-${layerIndex}`) || "stripe_center"} onChange={(event) => updateField(index, `shieldpat-${slot.key}-${layerIndex}`, event.target.value)}>{BANNER_PATTERNS.map(([value, name]) => <option key={value} value={value}>{name} ({value})</option>)}</select><div className="shield-layer-color"><select value={read(snapshot, index, `shieldcolor-${slot.key}-${layerIndex}`) || "black"} onChange={(event) => updateField(index, `shieldcolor-${slot.key}-${layerIndex}`, event.target.value)}>{DYE_COLORS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><ShieldColorPicker value={read(snapshot, index, `shieldcolor-${slot.key}-${layerIndex}`) || "black"} onChange={(value) => updateField(index, `shieldcolor-${slot.key}-${layerIndex}`, value)} /></div><button className="small danger" type="button" onClick={() => updateField(index, `shieldpat-${slot.key}-${layerIndex}`, "")}>×</button></div>)}</div>{nextShieldLayer !== undefined ? <button className="small info" type="button" onClick={addShieldLayer}>+ Добавить слой</button> : <p className="hint">Максимум 16 слоёв.</p>}</> : null}</div> : null}<details><summary>Зачарования {enchants.length ? "" : "(выбери предмет сначала)"}</summary><div className="enchant-list">{enchants.length ? enchants.map((enchant) => <div className="enchant-row" key={enchant.id}><label><input type="checkbox" checked={checked(snapshot, index, `ench-${slot.key}-${enchant.id}`)} onChange={(event) => updateField(index, `ench-${slot.key}-${enchant.id}`, event.target.checked)} /> {enchant.name} <span style={{ color: "var(--muted)", fontSize: 10 }}>({enchant.max})</span></label><input type="number" min="1" max={enchant.max} value={read(snapshot, index, `enchlvl-${slot.key}-${enchant.id}`) || enchant.max} onChange={(event) => updateField(index, `enchlvl-${slot.key}-${enchant.id}`, clampNumberInput(event.target.value, 1, enchant.max, { integer: true }))} /></div>) : <p className="hint">Для этого предмета зачарований нет.</p>}</div></details></div>;
}

function Preview({ snapshot }: { snapshot: SummonSnapshot }) {
  return <div id="summon-preview">{snapshot.mobOrder.map((mob, index) => {
    const data = getPreviewData(snapshot, index);
    const mobName = ALL_MOBS[data.mobType] || data.mobType;
    return <div className={`preview-card ${index === 0 ? "main" : "passenger"}`} key={index}><div className="preview-top"><span className="preview-role">{index === 0 ? "Основной моб" : `Пассажир ${index}`}</span><span className="preview-relation">{index === 0 ? "нижний уровень" : index === 1 ? "сидит на основном мобе" : `сидит на пассажире ${index - 1}`}</span></div><div className="preview-title">{data.customName || mobName}</div><div className="preview-type">{mobName} <code>{data.mobType}</code></div>{data.stats.length || data.flags.length ? <div className="preview-chips">{[...data.stats, ...data.flags].map((item) => <span key={item}>{item}</span>)}</div> : null}{data.gear.length ? <ul className="preview-gear">{data.gear.map((item) => <li key={item.slot}><span>{item.slot}</span><strong>{item.item}</strong>{item.extras.length ? <em>{item.extras.join(" · ")}</em> : null}</li>)}</ul> : <p className="preview-empty">Без снаряжения</p>}{data.effects.length ? <div className="preview-effects"><span>Эффекты:</span> {data.effects.join(", ")}</div> : null}</div>;
  })}</div>;
}
