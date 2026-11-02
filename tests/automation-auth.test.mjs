import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { automationEnabled, verifyAutomationKey, automationKeyVersion, validAutomationIdentity, AUTOMATION_SESSION_SECONDS } = require('../.test-build/server/automation-auth.js');

test('service access: opt-in, key validation, fixed expiry and revocation', () => {
  const original = { ...process.env };
  try {
    process.env.AUTH_SECRET = 'session-secret';
    process.env.AUTOMATION_ACCESS_SECRET = 'a'.repeat(43);
    delete process.env.AUTOMATION_ACCESS_ENABLED;
    assert.equal(automationEnabled(), false);
    assert.equal(verifyAutomationKey('a'.repeat(43)), false);
    process.env.AUTOMATION_ACCESS_ENABLED = 'true';
    assert.equal(verifyAutomationKey('a'.repeat(43)), true);
    for (const key of [null, undefined, {}, '', 'wrong', 'a'.repeat(513)]) assert.equal(verifyAutomationKey(key), false);
    const now = Math.floor(Date.now() / 1000) * 1000;
    const identity = { automationRole: 'admin', automationExpiresAt: now / 1000 + AUTOMATION_SESSION_SECONDS, automationKeyVersion: automationKeyVersion() };
    assert.equal(validAutomationIdentity(identity, now), true);
    assert.equal(validAutomationIdentity({ ...identity, automationRole: 'member' }, now), true);
    assert.equal(validAutomationIdentity({ ...identity, automationRole: 'owner' }, now), false);
    assert.equal(validAutomationIdentity({ ...identity, automationExpiresAt: now / 1000 + 301 }, now), false);
    assert.equal(validAutomationIdentity({ ...identity, automationExpiresAt: Infinity }, now), false);
    assert.equal(validAutomationIdentity(identity, now + AUTOMATION_SESSION_SECONDS * 1000), false);
    process.env.AUTOMATION_ACCESS_SECRET = 'b'.repeat(43);
    assert.equal(validAutomationIdentity(identity, now), false);
    process.env.AUTOMATION_ACCESS_ENABLED = 'false';
    assert.equal(validAutomationIdentity(identity, now), false);
    process.env.AUTOMATION_ACCESS_ENABLED = 'true';
    process.env.AUTOMATION_ACCESS_SECRET = 'short';
    assert.equal(automationEnabled(), false);
    process.env.AUTOMATION_ACCESS_SECRET = 'a'.repeat(43);
    delete process.env.AUTH_SECRET;
    assert.equal(automationEnabled(), false);
  } finally { process.env = original; }
});
