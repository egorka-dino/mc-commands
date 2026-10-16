import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGiveSnapshot, buildGiveCommand, getGivePreviewData } from '../.test-build/components/give/engine.js';
import { buildNBTPartsFor, buildSummonCommand } from '../.test-build/components/summon/engine.js';
import { POST } from '../.test-build/api/ai/command/route.js';

process.env.OPENAI_API_KEY = 'test-key';
let operations = [];
let upstream;
globalThis.fetch = async (_url, options) => {
  upstream = JSON.parse(options.body);
  return Response.json({ output_text: JSON.stringify({ operations }) });
};
async function call(body) {
  const response = await POST(new Request('http://localhost/api/ai/command', { method: 'POST', body: JSON.stringify(body) }));
  return { status: response.status, ...await response.json() };
}
const initial = { mobOrder: [{ mobType: 'zombie' }, { mobType: 'chicken' }], fields: {
  '0-mob': 'zombie', '0-name': 'Рыцарь', '0-health': '75', '0-slot-head': 'netherite_helmet', '1-mob': 'chicken', '1-baby': true,
} };

test('successive refinements preserve manual settings and passengers, send bounded history', async () => {
  operations = [{ action: 'set_equipment', slot: 'mainhand', itemId: 'diamond_sword' }];
  const first = await call({ mode: 'summon', prompt: 'Добавь меч', snapshot: initial, history: [
    { role: 'system', content: 'untrusted' }, { role: 'user', content: 'Собери рыцаря' },
  ] });
  assert.equal(first.status, 200);
  assert.equal(first.snapshot.fields['0-name'], 'Рыцарь');
  assert.equal(first.snapshot.fields['0-health'], '75');
  assert.equal(first.snapshot.fields['0-slot-head'], 'netherite_helmet');
  assert.deepEqual(first.snapshot.mobOrder, initial.mobOrder);
  assert.equal(upstream.input.filter(m => m.role === 'system').length, 1);
  assert.match(upstream.input.at(-1).content, /Рыцарь/);
  operations = [{ action: 'set_boolean', field: 'glow', value: true }];
  const second = await call({ mode: 'summon', prompt: 'Пусть светится', snapshot: first.snapshot });
  assert.equal(second.snapshot.fields['0-slot-mainhand'], 'diamond_sword');
  assert.equal(second.snapshot.fields['0-glow'], true);
  assert.equal(initial.fields['0-slot-mainhand'], undefined);
});

test('removes equipment settings, effects, enchants and reindexes a removed passenger', async () => {
  operations = [{ action: 'clear_equipment', slot: 'head' }, { action: 'remove_effect', effectId: 'speed' },
    { action: 'remove_equipment_enchant', slot: 'mainhand', enchantId: 'sharpness' }, { action: 'remove_mob', index: 1 }];
  const result = await call({ mode: 'summon', prompt: 'Убери лишнее', snapshot: {
    mobOrder: [...initial.mobOrder, { mobType: 'skeleton' }], fields: { ...initial.fields,
      '0-trimon-head': true, '0-ench-head-protection': true, '0-eff-speed': true,
      '0-slot-mainhand': 'diamond_sword', '0-ench-mainhand-sharpness': true,
      '2-mob': 'skeleton', '2-name': 'Верхний',
    },
  } });
  assert.equal(result.snapshot.fields['0-slot-head'], undefined);
  assert.equal(result.snapshot.fields['0-ench-head-protection'], undefined);
  assert.equal(result.snapshot.fields['0-trimon-head'], undefined);
  assert.equal(result.snapshot.fields['0-eff-speed'], false);
  assert.equal(result.snapshot.fields['0-ench-mainhand-sharpness'], false);
  assert.equal(result.snapshot.mobOrder[1].mobType, 'skeleton');
  assert.equal(result.snapshot.fields['1-name'], 'Верхний');
  assert.equal(result.snapshot.fields['2-name'], undefined);
});

test('fresh generation remains compatible, give stays independent', async () => {
  operations = [{ action: 'set_mob', mobType: 'skeleton' }];
  const fresh = await call({ mode: 'summon', prompt: 'Собери скелета' });
  assert.equal(fresh.snapshot.mobOrder[0].mobType, 'skeleton');
  assert.equal(fresh.snapshot.fields['0-name'], undefined);
  operations = [{ action: 'set_item', itemId: 'diamond_sword' }];
  const give = await call({ mode: 'give', prompt: 'Алмазный меч' });
  assert.equal(give.snapshot.itemId, 'diamond_sword');
});

test('rejects malformed state and prompts; invalid operations do not create passengers', async () => {
  for (const snapshot of [null, {}, { mobOrder: [{ mobType: 'bad' }], fields: {} }, { ...initial, fields: { '0-name': {} } }]) {
    assert.equal((await call({ mode: 'summon', prompt: 'Добавь щит', snapshot })).status, 400);
  }
  assert.equal((await call({ mode: 'summon', prompt: {} })).status, 400);
  operations = [{ action: 'remove_mob', index: 6 }, { action: 'unknown', index: 5 }, { action: 'set_mob', index: -1, mobType: 'skeleton' }];
  const result = await call({ mode: 'summon', prompt: 'Измени моба', snapshot: initial });
  assert.deepEqual(result.snapshot.mobOrder, initial.mobOrder);
});

test('upstream failure leaves request state untouched', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Timeout'); };
  const before = JSON.stringify(initial);
  const result = await call({ mode: 'summon', prompt: 'Добавь щит', snapshot: initial });
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(initial), before);
  globalThis.fetch = saved;
});


test('give refinements preserve manual name, lore, target and quantity across additions and removal', async () => {
  const initial = { ...defaultGiveSnapshot(), itemId: 'diamond_sword', count: '3', targetCustom: 'Steve',
    fields: { ...defaultGiveSnapshot().fields, name: 'Ручное имя', 'lore-4': 'История меча', 'ench-sharpness': true, 'enchlvl-sharpness': '5' } };
  operations = [{ action: 'set_enchant', enchantId: 'looting', level: 3 }];
  const first = await call({ mode: 'give', prompt: 'Добавь добычу III', snapshot: initial,
    history: [{role: 'user', content: 'Собери меч'}] });
  assert.equal(first.status, 200);
  assert.equal(first.snapshot.fields.name, 'Ручное имя');
  assert.equal(first.snapshot.fields['lore-4'], 'История меча');
  assert.equal(first.snapshot.count, '3');
  assert.equal(first.snapshot.targetCustom, 'Steve');
  assert.equal(first.snapshot.fields['enchlvl-looting'], '3');
  assert.equal(upstream.input[1].content, 'Собери меч');
  operations = [{ action: 'remove_enchant', enchantId: 'sharpness' }];
  const second = await call({ mode: 'give', prompt: 'Убери остроту', snapshot: first.snapshot });
  assert.equal(second.snapshot.fields['ench-sharpness'], undefined);
  assert.equal(second.snapshot.fields['ench-looting'], true);
  assert.equal(initial.fields['ench-looting'], undefined);
  assert.equal(second.snapshot.fields.name, 'Ручное имя');
});

test('changing item removes unsupported enchants and excludes them from commands and preview', async () => {
  const snapshot = { ...defaultGiveSnapshot(), itemId: 'diamond_sword', fields: { name: 'Имя', 'ench-sharpness': true, 'enchlvl-sharpness': '5', 'dye-on': true } };
  operations = [{ action: 'set_item', itemId: 'bow' }];
  const result = await call({ mode: 'give', prompt: 'Замени на лук', snapshot });
  assert.equal(result.snapshot.fields['ench-sharpness'], undefined);
  assert.equal(result.snapshot.fields.name, 'Имя');
  assert.ok(result.notes.some(note => note.includes('sharpness')));
  assert.ok(result.notes.some(note => note.includes('окраска')));
  const stale = { ...snapshot, itemId: 'bow' };
  assert.doesNotMatch(buildGiveCommand(stale), /sharpness/);
  assert.deepEqual(getGivePreviewData(stale).enchantments, []);
});

test('give special arrays preserve unchanged entries and support targeted removal', async () => {
  const snapshot = { ...defaultGiveSnapshot(), itemId: 'firework_rocket', explosions: [
    {id:1,shape:'star',colors:['#112233'],fadeColors:['#445566'],trail:true,twinkle:false},
    {id:2,shape:'burst',colors:['#abcdef'],fadeColors:[],trail:false,twinkle:true},
  ] };
  operations = [{ action: 'set_firework', index: 0, twinkle: true }];
  const first = await call({ mode: 'give', prompt: 'Первому взрыву добавь мерцание', snapshot });
  assert.equal(first.snapshot.explosions[0].trail, true);
  assert.deepEqual(first.snapshot.explosions[0].colors, ['#112233']);
  assert.deepEqual(first.snapshot.explosions[1], snapshot.explosions[1]);
  operations = [{ action: 'remove_firework', index: 0 }];
  const second = await call({ mode: 'give', prompt: 'Удали первый взрыв', snapshot:first.snapshot });
  assert.equal(second.snapshot.explosions.length,1);
  assert.equal(second.snapshot.explosions[0].id,2);
  const shield = { ...defaultGiveSnapshot(), itemId: 'shield', fields:{'shield-on':true}, shieldLayers:[{id:1,pattern:'stripe_center',color:'red'},{id:2,pattern:'cross',color:'blue'}] };
  operations = [{action:'set_shield',color:'green'}];
  const colored = await call({mode:'give',prompt:'Сделай основу зелёной',snapshot:shield});
  assert.deepEqual(colored.snapshot.shieldLayers,shield.shieldLayers);
  operations = [{action:'remove_shield_layer',index:0}];
  const removed = await call({mode:'give',prompt:'Удали первый узор',snapshot:colored.snapshot});
  assert.deepEqual(removed.snapshot.shieldLayers,[shield.shieldLayers[1]]);
});

test('give rejects malformed nested state, bounds history and clears a custom target on explicit selection', async () => {
  for (const snapshot of [null, {}, { ...defaultGiveSnapshot(), explosions:[{}] }, { ...defaultGiveSnapshot(), fields:{name:{}} }]) {
    assert.equal((await call({mode:'give',prompt:'Добавь чары',snapshot})).status,400);
  }
  operations = [{action:'set_target',target:'@p'}];
  const result = await call({mode:'give',prompt:'Дай ближайшему',snapshot:{...defaultGiveSnapshot(),targetCustom:'Steve'},history:Array.from({length:30},()=>({role:'user',content:'a'.repeat(2000)}))});
  assert.equal(result.snapshot.targetCustom,'');
  assert.equal(result.snapshot.target,'@p');
  assert.equal(upstream.input.length,14);
  assert.equal(upstream.input[1].content.length,1500);
});

test('fresh negative description does not re-add a removed enchantment', async () => {
  operations = [{action:'set_item',itemId:'diamond_sword'},{action:'remove_enchant',enchantId:'sharpness'}];
  const result = await call({mode:'give',prompt:'Алмазный меч без остроты'});
  assert.equal(result.snapshot.fields['ench-sharpness'],undefined);
});


test('changing a food effect level preserves duration and probability', async () => {
  operations = [{action:'set_food_effect',index:0,effectId:'speed',level:3}];
  const result = await call({mode:'give',prompt:'Усиль скорость до III',snapshot:{...defaultGiveSnapshot(),itemId:'apple',fields:{'food-eff-on-0':true,'food-eff-0':'speed','food-eff-amp-0':'0','food-eff-dur-0':'1200','food-eff-prob-0':'0.5'}}});
  assert.equal(result.snapshot.fields['food-eff-amp-0'],'2');
  assert.equal(result.snapshot.fields['food-eff-dur-0'],'1200');
  assert.equal(result.snapshot.fields['food-eff-prob-0'],'0.5');
});


test('refines mobs with underscore effect and enchantment IDs generated by the editor', async () => {
  const snapshot = { mobOrder: [{ mobType: 'zombie' }, { mobType: 'chicken' }], fields: {
    '0-mob': 'zombie', '0-slot-head': 'netherite_helmet',
    '0-ench-head-fire_protection': true, '0-enchlvl-head-fire_protection': '4',
    '0-eff-fire_resistance': true, '0-effamp-fire_resistance': '0', '0-effdur-fire_resistance': '1200',
    '1-mob': 'chicken', '1-eff-slow_falling': true, '1-effamp-slow_falling': '0', '1-effdur-slow_falling': '3600',
  } };
  operations = [{ action: 'set_boolean', field: 'glow', value: true }];
  const result = await call({ mode: 'summon', prompt: 'Добавь свечение основному мобу', snapshot });
  assert.equal(result.status, 200, result.error);
  assert.equal(result.snapshot.fields['0-glow'], true);
  for (const [key, value] of Object.entries(snapshot.fields)) assert.equal(result.snapshot.fields[key], value);
  assert.deepEqual(result.snapshot.mobOrder, snapshot.mobOrder);
});

test('refines items with underscore enchantment IDs without rejecting the current state', async () => {
  const snapshot = { ...defaultGiveSnapshot(), itemId: 'diamond_sword', fields: {
    ...defaultGiveSnapshot().fields, 'ench-sweeping_edge': true, 'enchlvl-sweeping_edge': '3',
  } };
  operations = [{ action: 'set_text', field: 'name', value: 'Проверка' }];
  const result = await call({ mode: 'give', prompt: 'Назови меч Проверка', snapshot });
  assert.equal(result.status, 200, result.error);
  assert.equal(result.snapshot.fields.name, 'Проверка');
  assert.equal(result.snapshot.fields['ench-sweeping_edge'], true);
});

test('leather dye accepts palette IDs and hex colors in both generators', async () => {
  operations = [{action:'set_equipment',slot:'chest',itemId:'leather_chestplate'},
    {action:'set_equipment_dye',slot:'chest',color:'red'}];
  const summon = await call({mode:'summon',prompt:'Красная кожаная куртка',snapshot:initial});
  assert.equal(summon.snapshot.fields['0-dye-chest'],'#b02e26');
  assert.match(buildNBTPartsFor(summon.snapshot,0).join(','), /"minecraft:dyed_color":11546150/);
  assert.deepEqual(summon.snapshot.mobOrder,initial.mobOrder);
  operations = [{action:'set_item',itemId:'leather_helmet'},{action:'set_dye',color:'#123abc'}];
  const give = await call({mode:'give',prompt:'Покрась кожаный шлем'});
  assert.match(buildGiveCommand(give.snapshot), /dyed_color=1194684/);
  operations = [{action:'set_dye',color:'blue'}];
  const blue = await call({mode:'give',prompt:'Теперь синий',snapshot:give.snapshot});
  assert.equal(blue.snapshot.fields['dye-color'],'#3c44aa');
  operations = [{action:'set_dye',color:'invalid'}];
  assert.deepEqual((await call({mode:'give',prompt:'Неверный цвет',snapshot:blue.snapshot})).snapshot,blue.snapshot);
});

test('summon shield operations target passenger layers and preserve unrelated settings', async () => {
  operations = [{action:'set_equipment',index:1,slot:'offhand',itemId:'shield'},
    {action:'set_equipment_shield',index:1,slot:'offhand',color:'red'},
    {action:'set_equipment_shield',index:1,slot:'offhand',layerIndex:0,pattern:'straight_cross',color:'white'},
    {action:'set_equipment_shield',index:1,slot:'offhand',pattern:'border',color:'black'}];
  const first = await call({mode:'summon',prompt:'Пассажиру красный щит с белым крестом и чёрной рамкой',snapshot:initial});
  const command = buildNBTPartsFor(first.snapshot,1).join(',');
  assert.match(command,/base_color:"red"/);
  assert.match(command,/pattern:"minecraft:straight_cross",color:"white"/);
  assert.match(command,/pattern:"minecraft:border",color:"black"/);
  assert.equal(first.snapshot.fields['0-name'],'Рыцарь');
  operations = [{action:'set_equipment_shield',index:1,slot:'offhand',layerIndex:0,color:'yellow'}];
  const second = await call({mode:'summon',prompt:'Крест сделай жёлтым',snapshot:first.snapshot});
  assert.equal(second.snapshot.fields['1-shieldpat-offhand-0'],'straight_cross');
  assert.equal(second.snapshot.fields['1-shieldcolor-offhand-0'],'yellow');
  assert.equal(second.snapshot.fields['1-shieldbase-offhand'],'red');
  operations = [{action:'remove_equipment_shield_layer',index:1,slot:'offhand',layerIndex:0}];
  const removed = await call({mode:'summon',prompt:'Убери крест',snapshot:second.snapshot});
  assert.doesNotMatch(buildNBTPartsFor(removed.snapshot,1).join(','),/straight_cross/);
  assert.equal(removed.snapshot.fields['1-shieldpat-offhand-1'],'border');
  operations = [{action:'clear_equipment_shield_layers',index:1,slot:'offhand'}];
  const cleared = await call({mode:'summon',prompt:'Убери все узоры',snapshot:removed.snapshot});
  assert.doesNotMatch(buildNBTPartsFor(cleared.snapshot,1).join(','),/banner_patterns/);
  assert.match(buildNBTPartsFor(cleared.snapshot,1).join(','),/base_color:"red"/);
  operations = [{action:'clear_equipment_shield',index:1,slot:'offhand'}];
  const disabled = await call({mode:'summon',prompt:'Сними оформление',snapshot:cleared.snapshot});
  assert.doesNotMatch(buildNBTPartsFor(disabled.snapshot,1).join(','),/base_color/);
});

test('invalid summon shield operations and incompatible leather dye leave state untouched', async () => {
  operations = [{action:'set_equipment_shield',slot:'head',pattern:'border',color:'red'},
    {action:'set_equipment_dye',slot:'head',color:'red'},
    {action:'set_equipment_shield',slot:'offhand',layerIndex:16,pattern:'border'},
    {action:'set_equipment_shield',slot:'offhand',layerIndex:-1,pattern:'border'},
    {action:'set_equipment_shield',slot:'offhand',pattern:'unknown'},
    {action:'set_equipment_shield',slot:'offhand',pattern:'border',color:'unknown'}];
  const snapshot = {...initial,fields:{...initial.fields,'0-slot-offhand':'shield'}};
  const result = await call({mode:'summon',prompt:'Неверные настройки',snapshot});
  for (const [key,value] of Object.entries(snapshot.fields)) assert.equal(result.snapshot.fields[key],value);
  assert.equal(result.snapshot.fields['0-shieldon-offhand'],undefined);
  assert.equal(result.snapshot.fields['0-dyeon-head'],undefined);
});

test('give appends shield layers and recolors a layer without changing its pattern or base', async () => {
  operations = [{action:'set_item',itemId:'shield'},{action:'set_shield',color:'red'},
    {action:'set_shield',pattern:'straight_cross',color:'white'},
    {action:'set_shield',pattern:'border',color:'black'}];
  const first = await call({mode:'give',prompt:'Красный щит с белым крестом и чёрной рамкой'});
  assert.equal(first.snapshot.shieldLayers.length,2);
  assert.deepEqual(first.snapshot.shieldLayers.map(({pattern,color})=>({pattern,color})),[
    {pattern:'straight_cross',color:'white'},{pattern:'border',color:'black'}]);
  assert.match(buildGiveCommand(first.snapshot),/base_color="red"/);
  operations = [{action:'set_shield',index:0,color:'yellow'}];
  const second = await call({mode:'give',prompt:'Крест сделай жёлтым',snapshot:first.snapshot});
  assert.equal(second.snapshot.fields['shield-base'],'red');
  assert.equal(second.snapshot.shieldLayers[0].pattern,'straight_cross');
  assert.equal(second.snapshot.shieldLayers[0].color,'yellow');
  assert.deepEqual(second.snapshot.shieldLayers[1],first.snapshot.shieldLayers[1]);
  operations = [{action:'set_item',itemId:'shield'},{action:'set_shield',color:'blue'}];
  const plain = await call({mode:'give',prompt:'Просто синий щит'});
  assert.doesNotMatch(buildGiveCommand(plain.snapshot),/banner_patterns/);
});


const rider = { mobOrder: [{ mobType: 'zombie' }, { mobType: 'chicken' }], fields: {
  ...initial.fields, '0-slot-mainhand': 'diamond_sword', '0-count-mainhand': '2',
  '0-drop-mainhand': '0.37', '0-ench-mainhand-sharpness': true, '0-enchlvl-mainhand-sharpness': '7',
  '0-slot-chest': 'leather_chestplate', '0-dyeon-chest': true, '0-dye-chest': '#123abc',
  '0-trimon-head': true, '0-trimmat-head': 'gold', '0-trimpat-head': 'sentry',
  '0-slot-offhand': 'shield', '0-shieldon-offhand': true, '0-shieldbase-offhand': 'red',
  '0-shieldpat-offhand-0': 'border', '0-shieldcolor-offhand-0': 'white',
  '0-eff-strength': true, '0-effamp-strength': '2', '0-effdur-strength': '1200',
  '0-scale': '1.3', '0-glow': true, '0-future-setting': 'preserved',
} };
const fieldsAt = (snapshot, index) => Object.fromEntries(Object.entries(snapshot.fields)
  .filter(([key]) => key.startsWith(`${index}-`)).map(([key, value]) => [key.slice(2), value]));

test('inserting a mount moves the entire rider and existing passengers without copying equipment', async () => {
  const before = structuredClone(rider);
  operations = [{ action: 'insert_mob', index: 0, mobType: 'horse' }];
  const result = await call({ mode: 'summon', prompt: 'Посади его на лошадь', snapshot: rider });
  assert.equal(result.status, 200);
  assert.deepEqual(result.snapshot.mobOrder.map(m => m.mobType), ['horse', 'zombie', 'chicken']);
  assert.deepEqual(fieldsAt(result.snapshot, 1), fieldsAt(rider, 0));
  assert.deepEqual(fieldsAt(result.snapshot, 2), fieldsAt(rider, 1));
  assert.deepEqual(fieldsAt(result.snapshot, 0), { mob: 'horse', persist: true, 'name-visible': true });
  const command = buildSummonCommand(result.snapshot);
  assert.match(command, /^\/summon minecraft:horse ~ ~ ~ /);
  assert.match(command, /Passengers:\[\{id:"minecraft:zombie"/);
  assert.match(command, /diamond_sword/);
  assert.equal(buildNBTPartsFor(result.snapshot, 0).join(''), 'PersistenceRequired:1b');
  assert.deepEqual(rider, before);
  assert.match(upstream.input[0].content, /insert_mob/);
  assert.match(upstream.input[0].content, /move_mob/);
  assert.equal(upstream.text.format.schema.properties.operations.items.properties.toIndex.type, 'integer');
});

test('moving mobs in either direction preserves every field and later operations use new indices', async () => {
  operations = [{ action: 'move_mob', index: 1, toIndex: 0 }];
  const swapped = await call({ mode: 'summon', prompt: 'Поменяй их местами', snapshot: rider });
  assert.deepEqual(swapped.snapshot.mobOrder.map(m => m.mobType), ['chicken', 'zombie']);
  assert.deepEqual(fieldsAt(swapped.snapshot, 1), fieldsAt(rider, 0));
  assert.deepEqual(fieldsAt(swapped.snapshot, 0), fieldsAt(rider, 1));
  operations = [{ action: 'move_mob', index: 0, toIndex: 1 }];
  const restored = await call({ mode: 'summon', prompt: 'Верни обратно', snapshot: swapped.snapshot });
  assert.deepEqual(restored.snapshot, rider);
  operations = [{ action: 'insert_mob', index: 1, mobType: 'pig' },
    { action: 'set_text', index: 2, field: 'name', value: 'Пассажир' }];
  const middle = await call({ mode: 'summon', prompt: 'Добавь свинью под курицей и назови курицу', snapshot: rider });
  assert.deepEqual(middle.snapshot.mobOrder.map(m => m.mobType), ['zombie', 'pig', 'chicken']);
  assert.deepEqual(fieldsAt(middle.snapshot, 0), fieldsAt(rider, 0));
  assert.equal(middle.snapshot.fields['2-baby'], true);
  assert.equal(middle.snapshot.fields['2-name'], 'Пассажир');
});

test('structural operations reject invalid indices, unknown mobs and overflow without losing characters', async () => {
  operations = [
    ...[-1, 0.5, 3, 6].map(index => ({ action: 'insert_mob', index, mobType: 'horse' })),
    { action: 'insert_mob', index: 0, mobType: 'unknown' },
    ...[-1, 0.5, 2, 6, undefined, null, '1'].map(toIndex => ({ action: 'move_mob', index: 0, toIndex })),
    { action: 'move_mob', index: 4, toIndex: 0 },
    { action: 'move_mob', index: 0, toIndex: 0 },
  ];
  const invalid = await call({ mode: 'summon', prompt: 'Измени порядок', snapshot: rider });
  assert.deepEqual(invalid.snapshot, rider);
  operations = [{ action: 'insert_mob', index: 2, mobType: 'horse' }];
  const appended = await call({ mode: 'summon', prompt: 'Добавь лошадь сверху', snapshot: rider });
  assert.deepEqual(appended.snapshot.mobOrder.map(m => m.mobType), ['zombie', 'chicken', 'horse']);
  const full = { mobOrder: Array.from({ length: 6 }, () => ({ mobType: 'zombie' })),
    fields: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`${i}-name`, `Моб ${i}`])) };
  operations = [{ action: 'insert_mob', index: 0, mobType: 'horse' }];
  const capped = await call({ mode: 'summon', prompt: 'Посади его на лошадь', snapshot: full });
  assert.equal(capped.snapshot.mobOrder.length, 6);
  for (let i = 0; i < 6; i++) assert.equal(capped.snapshot.fields[`${i}-name`], `Моб ${i}`);
  assert.match(capped.notes.join(''), /уже 6 мобов/);
});


test('mount_mob seats the armored zombie on a spider and preserves all rider fields', async () => {
  operations = [{ action: 'mount_mob', index: 0, mobType: 'spider' }];
  const result = await call({ mode: 'summon', prompt: 'Посади его на паука', snapshot: rider });
  assert.deepEqual(result.snapshot.mobOrder.map(m => m.mobType), ['spider', 'zombie', 'chicken']);
  assert.deepEqual(fieldsAt(result.snapshot, 1), fieldsAt(rider, 0));
  assert.deepEqual(fieldsAt(result.snapshot, 2), fieldsAt(rider, 1));
  assert.equal(result.snapshot.fields['0-slot-head'], undefined);
  operations = [{ action: 'mount_mob', index: 1, mobType: 'horse' }];
  const nested = await call({ mode: 'summon', prompt: 'Посади курицу на лошадь', snapshot: rider });
  assert.deepEqual(nested.snapshot.mobOrder.map(m => m.mobType), ['zombie', 'horse', 'chicken']);
  assert.deepEqual(fieldsAt(nested.snapshot, 0), fieldsAt(rider, 0));
  assert.deepEqual(fieldsAt(nested.snapshot, 2), fieldsAt(rider, 1));
  operations = [{ action: 'mount_mob', index: 2, mobType: 'spider' }];
  const invalid = await call({ mode: 'summon', prompt: 'Посади на паука', snapshot: rider });
  assert.deepEqual(invalid.snapshot, rider);
});


test('removing the root promotes the entire next mob and preserves the remaining passenger chain', async () => {
  const snapshot = { mobOrder: [{ mobType: 'spider' }, { mobType: 'horse' }, { mobType: 'zombie' }, { mobType: 'chicken' }], fields: {
    '0-mob': 'spider', '0-name': 'Удалить', '0-eff-speed': true,
    '1-mob': 'horse', '1-name': 'Конь', '1-horse-coat': '4', '1-health': '40',
    ...Object.fromEntries(Object.entries(rider.fields).map(([key, value]) => [`${Number(key[0]) + 2}-${key.slice(2)}`, value])),
  } };
  const before = structuredClone(snapshot);
  operations = [{ action: 'remove_mob', index: 0 }];
  const result = await call({ mode: 'summon', prompt: 'Убери паука', snapshot });
  assert.deepEqual(result.snapshot.mobOrder.map(m => m.mobType), ['horse', 'zombie', 'chicken']);
  for (let i = 0; i < 3; i++) assert.deepEqual(fieldsAt(result.snapshot, i), fieldsAt(snapshot, i + 1));
  assert.ok(!Object.keys(result.snapshot.fields).some(key => key.startsWith('3-')));
  assert.deepEqual(snapshot, before);
  assert.match(buildSummonCommand(result.snapshot), /^\/summon minecraft:horse/);
  assert.match(buildSummonCommand(result.snapshot), /Passengers:\[\{id:"minecraft:zombie"/);
  const second = await call({ mode: 'summon', prompt: 'Теперь убери лошадь', snapshot: result.snapshot });
  assert.deepEqual(second.snapshot.mobOrder.map(m => m.mobType), ['zombie', 'chicken']);
  assert.deepEqual(fieldsAt(second.snapshot, 0), fieldsAt(rider, 0));
  assert.deepEqual(fieldsAt(second.snapshot, 1), fieldsAt(rider, 1));
  assert.match(buildSummonCommand(second.snapshot), /^\/summon minecraft:zombie/);
});

test('root removal followed by edits uses new indices; deleting the last mob reports the limit', async () => {
  operations = [{ action: 'remove_mob', index: 0 }, { action: 'set_text', index: 0, field: 'name', value: 'Осталась курица' }];
  const result = await call({ mode: 'summon', prompt: 'Убери зомби и назови курицу', snapshot: rider });
  assert.deepEqual(result.snapshot.mobOrder, [{ mobType: 'chicken' }]);
  assert.equal(result.snapshot.fields['0-name'], 'Осталась курица');
  assert.equal(result.snapshot.fields['0-baby'], true);
  assert.equal(result.snapshot.fields['0-slot-head'], undefined);
  operations = [{ action: 'remove_mob', index: 0 }];
  const last = await call({ mode: 'summon', prompt: 'Убери курицу', snapshot: result.snapshot });
  assert.deepEqual(last.snapshot, result.snapshot);
  assert.match(last.notes.join(''), /Нельзя удалить единственного моба/);
});
