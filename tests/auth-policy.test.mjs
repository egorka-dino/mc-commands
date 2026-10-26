import assert from 'node:assert/strict';
import test from 'node:test';
import { getAppUserId, getSafeRedirectUrl, isAdminEmail, isGoogleAuthConfigured } from '../.test-build/server/auth-policy.js';

test('redirect rejects external, protocol-relative, backslash and control-character destinations', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', undefined, 'javascript:alert(1)']) {
    assert.equal(getSafeRedirectUrl(value), '/');
  }
  assert.equal(getSafeRedirectUrl('/locations?q=a#base'), '/locations?q=a#base');
  assert.equal(getSafeRedirectUrl(['/admin', '//evil.test']), '/admin');
});

test('admin access is deny-by-default and uses exact email matches', () => {
  process.env.AUTH_ADMIN_EMAILS = '';
  assert.equal(isAdminEmail('admin@example.test'), false);
  process.env.AUTH_ADMIN_EMAILS = ' admin@example.test, second@example.test ';
  assert.equal(isAdminEmail('ADMIN@example.test'), true);
  assert.equal(isAdminEmail('otheradmin@example.test'), false);
  assert.equal(isAdminEmail(null), false);
  delete process.env.AUTH_ADMIN_EMAILS;
});

test('legacy identity mapping preserves ownership and rejects ambiguous mappings', () => {
  delete process.env.AUTH_LEGACY_USER_IDS;
  assert.equal(getAppUserId('123'), 'google:123');
  process.env.AUTH_LEGACY_USER_IDS = '{"123":"user_old"}';
  assert.equal(getAppUserId('123'), 'user_old');
  assert.equal(getAppUserId('456'), 'google:456');
  for (const value of ['[]', 'null', 'bad', '{"123":"user_old","456":"user_old"}', '{"123":"google:456"}']) {
    process.env.AUTH_LEGACY_USER_IDS = value;
    assert.throws(() => getAppUserId('123'));
  }
  delete process.env.AUTH_LEGACY_USER_IDS;
});

test('missing configuration disables login', () => {
  for (const name of ['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']) delete process.env[name];
  assert.equal(isGoogleAuthConfigured(), false);
  process.env.AUTH_GOOGLE_ID = 'id'; process.env.AUTH_GOOGLE_SECRET = 'client-secret';
  assert.equal(isGoogleAuthConfigured(), false);
  process.env.AUTH_SECRET = 'session-secret';
  assert.equal(isGoogleAuthConfigured(), true);
});
