import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPreviewScene } from '../.test-build/components/summon/preview-scene.js';
import { buildSummonCommand, getPreviewData, toSnapshot } from '../.test-build/components/summon/engine.js';

test('horse color changes texture and command while retaining one geometry', () => {
  const snapshot = toSnapshot(['horse']);
  snapshot.fields['0-horse-coat'] = '4';
  const black = buildPreviewScene(snapshot)[0];
  assert.equal(black.texture, 'horse/horse_black');
  assert.match(buildSummonCommand(snapshot), /Variant:4/);
  assert.ok(getPreviewData(snapshot, 0).stats.some(s => s.includes('Вороная')));
  snapshot.fields['0-horse-coat'] = '6';
  const brown = buildPreviewScene(snapshot)[0];
  assert.equal(brown.model, black.model);
  assert.equal(brown.texture, 'horse/horse_darkbrown');
});

test('scene retains passenger order, age, scale and displayed equipment', () => {
  const snapshot = toSnapshot(['ravager','zombie','skeleton']);
  Object.assign(snapshot.fields, {'1-baby':true,'1-scale':'2','1-slot-chest':'diamond_chestplate','1-slot-mainhand':'diamond_sword','2-slot-mainhand':'bow'});
  const result = buildPreviewScene(snapshot);
  assert.deepEqual(result.map(e => e.id), ['ravager','zombie','skeleton']);
  assert.deepEqual(result.map(e => e.riding), [false,true,true]);
  assert.equal(result[1].model,'zombie_baby');
  assert.equal(result[1].scale,2);
  assert.equal(result[1].equipment.length,2);
  assert.match(buildSummonCommand(snapshot), /Passengers:.*zombie.*Passengers:.*skeleton/);
});

test('non-rendered equipment is never painted onto ravagers or horses', () => {
  for (const type of ['ravager','horse']) {
    const snapshot = toSnapshot([type]);
    Object.assign(snapshot.fields, {'0-slot-head':'diamond_helmet','0-slot-mainhand':'diamond_sword'});
    const result = buildPreviewScene(snapshot)[0];
    assert.deepEqual(result.equipment,[]);
    assert.ok(result.warnings.every(w => w.includes('Minecraft не отображает')));
    assert.equal(getPreviewData(snapshot,0).gear.length,2);
  }
});

test('unsupported items and mobs keep explicit fallback warnings and text data', () => {
  const snapshot = toSnapshot(['zombie','creeper']);
  snapshot.fields['0-slot-mainhand'] = 'shield';
  const result = buildPreviewScene(snapshot);
  assert.equal(result[0].equipment.length,0);
  assert.ok(result[0].warnings.some(w => w.includes('shield')));
  assert.ok(result[1].warnings.some(w => w.includes('не подключена')));
  assert.equal(getPreviewData(snapshot,0).gear.length,1);
});

test('leather dye is visual, health is textual, invalid scales cannot poison the scene', () => {
  const snapshot = toSnapshot(['zombie']);
  Object.assign(snapshot.fields, {'0-slot-head':'leather_helmet','0-dyeon-head':true,'0-dye-head':'#ff0000','0-health':'120','0-scale':'NaN'});
  const result = buildPreviewScene(snapshot)[0];
  assert.equal(result.scale,1);
  assert.equal(result.equipment[0].dye,'#ff0000');
  assert.ok(getPreviewData(snapshot,0).stats.includes('HP: 120'));
});
