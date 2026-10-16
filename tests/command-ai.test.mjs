import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGiveSnapshot, buildGiveCommand, getGivePreviewData } from '../.test-build/components/give/engine.js';
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
  operations = [{ action: 'remove_mob', index: 0 }, { action: 'unknown', index: 5 }, { action: 'set_mob', index: -1, mobType: 'skeleton' }];
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
