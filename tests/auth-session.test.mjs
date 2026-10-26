import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { encode } from 'next-auth/jwt';

// Real production server and Auth.js cookies; never uses real Google, Neon or Exaroton credentials.
const origin = 'http://localhost:3197';
const secret = randomBytes(32).toString('base64url');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3197'], {
  stdio: 'ignore',
  env: { ...process.env, AUTH_SECRET: secret, AUTH_GOOGLE_ID: 'test-client', AUTH_GOOGLE_SECRET: 'test-client-secret',
    AUTH_ADMIN_EMAILS: 'admin@example.test', AUTH_TRUST_HOST: 'true', AUTH_URL: origin,
    AUTH_LEGACY_USER_IDS: '{"google-admin":"user_legacy_admin"}', DATABASE_URL: '', EXAROTON_API_KEY: '', EXAROTON_API_TOKEN: '' },
});
const cookieName = 'authjs.session-token';
async function cookie(token) {
  return `${cookieName}=${await encode({ token, secret, salt: cookieName })}`;
}
async function request(path, sessionCookie, options = {}) {
  return fetch(origin + path, { redirect: 'manual', ...options, headers: { ...options.headers, ...(sessionCookie ? { Cookie: sessionCookie } : {}) } });
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'production server should start');
  const anonymous = await request('/api/auth/status');
  assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');
  assert.equal((await anonymous.json()).authenticated, false);
  assert.equal((await request('/api/admin/minecraft/servers')).status, 401);
  assert.equal((await request('/api/locations')).status, 401);
  assert.equal((await request('/admin')).status, 307);

  const memberCookie = await cookie({ googleId: 'member', email: 'member@example.test', name: 'Member', isAdmin: true, role: 'admin' });
  const member = await (await request('/api/auth/status', memberCookie)).json();
  assert.equal(member.user.id, 'google:member');
  assert.equal(member.user.isAdmin, false, 'role claims in the JWT must not grant access');
  assert.equal((await request('/api/admin/minecraft/servers', memberCookie)).status, 403);
  assert.equal((await request('/api/admin/library/items', memberCookie)).status, 403);

  const adminCookie = await cookie({ googleId: 'google-admin', email: 'admin@example.test', name: 'Admin' });
  const admin = await (await request('/api/auth/status', adminCookie)).json();
  assert.equal(admin.user.id, 'user_legacy_admin', 'legacy location owner ID is preserved');
  assert.equal(admin.user.isAdmin, true);
  assert.equal((await request('/admin', adminCookie)).status, 200);

  const tampered = `${memberCookie.slice(0, -12)}xxxxxxxxxxxx`;
  assert.equal((await (await request('/api/auth/status', tampered)).json()).authenticated, false);
  assert.equal((await request('/api/admin/minecraft/servers', tampered)).status, 401);
  const expired = `${cookieName}=${await encode({ token: { googleId: 'google-admin', email: 'admin@example.test' }, secret, salt: cookieName, maxAge: -3600 })}`;
  assert.equal((await (await request('/api/auth/status', expired)).json()).authenticated, false);

  const csrf = await request('/api/auth/csrf');
  const { csrfToken } = await csrf.json();
  assert.ok(csrfToken);
  const activeSession = await request('/api/auth/session', adminCookie);
  const active = await activeSession.json();
  const daysRemaining = (new Date(active.expires).getTime() - Date.now()) / 86400000;
  assert.ok(daysRemaining > 29 && daysRemaining <= 30, 'persistent session expires in 30 days');
  assert.ok(csrf.headers.get('set-cookie').includes('HttpOnly'));
  const beforeLogout = await request('/sign-out?redirect_url=//evil.test', adminCookie);
  assert.equal(beforeLogout.status, 307);
  assert.equal((await (await request('/api/auth/status', adminCookie)).json()).authenticated, true, 'GET sign-out must not mutate the session');
  assert.equal((await request('/sign-up?redirect_url=%2F%2Fevil.test')).headers.get('location'), '/sign-in?redirect_url=%2F');
  const forgedLogout = await request('/api/auth/signout', adminCookie, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ callbackUrl: origin + '/give' }),
  });
  assert.ok(!forgedLogout.headers.getSetCookie().some(value => value.startsWith(cookieName + '=;') && value.includes('Max-Age=0')),
    'POST without a CSRF token must not clear the session');
  const csrfCookies = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const logout = await request('/api/auth/signout', `${adminCookie}; ${csrfCookies}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ csrfToken, callbackUrl: origin + '/give' }),
  });
  assert.equal(logout.status, 200);
  assert.equal((await logout.json()).url, origin + '/give');
  assert.ok(logout.headers.getSetCookie().some(value => value.startsWith(cookieName + '=;') && value.includes('Max-Age=0')));
  console.log('PASS: real Auth.js JWT sessions, tampering/expiry, server admin checks, legacy ownership, private status and safe redirects');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
}
