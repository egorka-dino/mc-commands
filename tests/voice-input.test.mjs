import assert from 'node:assert/strict';
import test from 'node:test';
import { createVoiceSession } from '../.test-build/components/command-assistant/voice-input.js';

function setup(original = 'Зомби', limit = 1500) {
  let engine;
  const observed = { text: original, status: 'idle', message: '' };
  class FakeRecognition {
    constructor() { engine = this; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }
  const completions = [];
  const session = createVoiceSession(FakeRecognition, original, {
    text: value => observed.text = value,
    status: value => observed.status = value,
    message: value => observed.message = value,
    complete: (text, successful) => completions.push({ text, successful }),
  }, limit);
  session.start();
  const emit = (...entries) => engine.onresult?.({ results: entries.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal })) });
  return { session, engine, observed, emit, completions };
}

test('dictation appends once, replaces interim results, commits only final text', () => {
  const { session, engine, observed, emit } = setup();
  assert.equal(engine.lang, 'ru-RU');
  assert.equal(observed.status, 'listening');
  emit(['с мечом', false]);
  assert.equal(observed.text, 'Зомби с мечом');
  emit(['с алмазным мечом', true], ['и щитом', false]);
  emit(['с алмазным мечом', true], ['и щитом', false]);
  assert.equal(observed.text, 'Зомби с алмазным мечом и щитом');
  session.stop();
  assert.equal(observed.status, 'stopping');
  engine.onend();
  assert.equal(observed.text, 'Зомби с алмазным мечом');
  assert.equal(observed.status, 'idle');
});

test('cancel restores original and ignores late results and errors', () => {
  const { session, engine, observed, emit } = setup();
  emit(['с мечом', true]);
  const lateResult = engine.onresult;
  const lateError = engine.onerror;
  session.cancel();
  lateResult({ results: [{ 0: { transcript: 'не применять' }, isFinal: true }] });
  lateError({ error: 'network' });
  assert.deepEqual(observed, { text: 'Зомби', status: 'idle', message: '' });
  assert.equal(engine.aborted, true);
});

test('errors preserve original and finalized text, dispose ignores late events', () => {
  for (const error of ['not-allowed', 'audio-capture', 'network', 'no-speech', 'unknown']) {
    const { session, engine, observed, emit } = setup();
    emit(['с мечом', true], ['и щитом', false]);
    engine.onerror({ error });
    assert.equal(observed.text, 'Зомби с мечом');
    assert.equal(observed.status, 'idle');
    assert.ok(observed.message);
    session.dispose();
  }
  const { session, engine, observed } = setup();
  const lateEnd = engine.onend;
  session.dispose();
  lateEnd();
  assert.equal(observed.message, '');
  assert.equal(engine.aborted, true);
});

test('limit clamps output and stops recognition; silence explains retry', () => {
  const { engine, observed, emit } = setup('Зомби', 12);
  emit(['с алмазным мечом', true]);
  assert.equal(observed.text.length, 12);
  assert.equal(engine.stopped, true);
  assert.match(observed.message, /лимит/);
  engine.onend();
  assert.equal(observed.status, 'idle');
  const silent = setup();
  silent.engine.onend();
  assert.match(silent.observed.message, /Речь не распознана/);
  assert.equal(silent.observed.text, 'Зомби');
});

test('start failure returns to idle without losing text', () => {
  const observed = {};
  class FailingRecognition { start() { throw new Error('denied'); } abort() {} }
  const session = createVoiceSession(FailingRecognition, 'Исходный текст', {
    text: value => observed.text = value, status: value => observed.status = value,
    message: value => observed.message = value,
  });
  session.start();
  assert.equal(observed.status, 'idle');
  assert.equal(observed.text, 'Исходный текст');
  assert.match(observed.message, /Не удалось/);
});


test('apply can await final recognition, completing exactly once with the final text', () => {
  const { session, engine, emit, completions } = setup();
  emit(['с мечом', false]);
  session.stop();
  assert.deepEqual(completions, []);
  emit(['с алмазным мечом', true]);
  const lateEnd = engine.onend;
  engine.onend();
  lateEnd();
  assert.deepEqual(completions, [{ text: 'Зомби с алмазным мечом', successful: true }]);
});

test('cancel, silence and errors never authorize automatic application', () => {
  for (const ending of ['cancel', 'silence', 'error']) {
    const { session, engine, emit, completions } = setup();
    if (ending !== 'silence') emit(['с мечом', true]);
    session.stop();
    if (ending === 'cancel') session.cancel();
    else if (ending === 'error') engine.onerror({ error: 'network' });
    else engine.onend();
    assert.equal(completions.length, 1);
    assert.equal(completions[0].successful, false);
  }
});

test('recognition timeout preserves final text without authorizing application', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { session, engine, emit, completions, observed } = setup();
  emit(['с мечом', true], ['и щитом', false]);
  session.stop();
  t.mock.timers.tick(5000);
  assert.deepEqual(completions, [{ text: 'Зомби с мечом', successful: false }]);
  assert.equal(observed.status, 'idle');
  assert.equal(engine.aborted, true);
});
