import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { encode, decode } from 'next-auth/jwt';

// Test real Credentials + CSRF + encrypted cookies without Google/Neon/Exaroton.
const origin = 'http://localhost:3198';
const secret = randomBytes(32).toString('base64url');
const key = randomBytes(32).toString('base64url');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3198'], {
  stdio: 'ignore',
  env: { ...process.env, AUTH_SECRET: secret, AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '', AUTH_URL: origin,
    AUTH_TRUST_HOST: 'true', AUTOMATION_ACCESS_ENABLED: 'true', AUTOMATION_ACCESS_SECRET: key,
    DATABASE_URL: '', EXAROTON_API_KEY: '', EXAROTON_API_TOKEN: '' },
});
const cookieName = 'authjs.session-token';
const request = (path, cookie = '', options = {}) => fetch(origin + path, {
  redirect: 'manual', ...options, headers: { ...options.headers, Cookie: cookie },
});
const cookiePairs = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function login(role, suppliedKey = key, withCsrf = true) {
  const csrfResponse = await request('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();
  return request('/api/auth/callback/automation', cookiePairs(csrfResponse), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ key: suppliedKey, role, ...(withCsrf ? { csrfToken } : {}), callbackUrl: origin + '/' }),
  });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  assert.equal((await request('/automation')).status, 200);
  assert.equal((await request('/api/admin/minecraft/servers')).status, 401);
  for (const [role, suppliedKey, csrf] of [['admin', 'invalid', true], ['owner', key, true], ['admin', key, false]]) {
    const response = await login(role, suppliedKey, csrf);
    assert.ok(!response.headers.getSetCookie().some(value => value.startsWith(cookieName + '=') && !value.startsWith(cookieName + '=;')));
  }
  for (const role of ['member', 'admin']) {
    const response = await login(role);
    const cookie = cookiePairs(response);
    const sessionHeader = response.headers.getSetCookie().find(value => value.startsWith(cookieName + '='));
    assert.ok(sessionHeader?.includes('HttpOnly'));
    assert.ok(sessionHeader?.includes('SameSite=Lax'));
    const tokenValue = sessionHeader.split(';')[0].slice(cookieName.length + 1);
    const token = await decode({ token: tokenValue, secret, salt: cookieName });
    assert.ok(token.exp - Math.floor(Date.now() / 1000) <= 300);
    const status = await (await request('/api/auth/status', cookie)).json();
    assert.equal(status.configured, false, 'Google is deliberately not configured');
    assert.equal(status.provider, 'automation');
    assert.equal(status.user.id, 'automation:' + role);
    assert.equal(status.user.email, null);
    assert.equal(status.user.isAdmin, role === 'admin');
    const adminPage = await request('/admin', cookie);
    assert.equal(adminPage.status, 200);
    assert.equal((await adminPage.text()).includes('Доступ закрыт'), role !== 'admin');
    const servers = await request('/api/admin/minecraft/servers', cookie);
    assert.equal(servers.status, role === 'admin' ? 503 : 403, 'admin reaches the unconfigured backend');
    const activeResponse = await request('/api/auth/session', cookie);
    const active = await activeResponse.json();
    assert.equal(active.expires, new Date(token.automationExpiresAt * 1000).toISOString());
    const refreshed = activeResponse.headers.getSetCookie().find(value => value.startsWith(cookieName + '='));
    const refreshedToken = await decode({ token: refreshed.split(';')[0].slice(cookieName.length + 1), secret, salt: cookieName });
    assert.equal(refreshedToken.automationExpiresAt, token.automationExpiresAt, 'refresh must not extend access');
    for (const changes of [
      { automationExpiresAt: Math.floor(Date.now() / 1000) - 1 },
      { automationKeyVersion: createHash('sha256').update('old-key').digest('hex') },
      { automationRole: 'owner' },
    ]) {
      const invalid = `${cookieName}=${await encode({ token: { ...token, ...changes }, secret, salt: cookieName })}`;
      assert.equal((await (await request('/api/auth/status', invalid)).json()).authenticated, false);
      assert.equal((await request('/api/admin/minecraft/servers', invalid)).status, 401);
    }
    const csrfResponse = await request('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    const logout = await request('/api/auth/signout', cookie + '; ' + cookiePairs(csrfResponse), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, callbackUrl: origin + '/' }),
    });
    assert.ok(logout.headers.getSetCookie().some(value => value.startsWith(cookieName + '=;') && value.includes('Max-Age=0')));
  }
  console.log('PASS: service Credentials login without Google, CSRF, member/admin access, 5-minute fixed window, rotation rejection and logout');
} finally {
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
}
