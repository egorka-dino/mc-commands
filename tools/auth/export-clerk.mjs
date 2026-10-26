import { writeFile } from 'node:fs/promises';

// One-time, read-only export. Run with node --env-file=.env.local.
const secret = process.env.CLERK_SECRET_KEY;
if (!secret) throw new Error('CLERK_SECRET_KEY is required for the one-time export');
const mapping = Object.create(null);
const admins = new Set();
let offset = 0;
let missingGoogle = 0;
let total = 0;
const hasAdminRole = value => value?.role === 'admin' || value?.admin === true || (Array.isArray(value?.roles) && value.roles.includes('admin'));
for (;;) {
  const response = await fetch(`https://api.clerk.com/v1/users?limit=100&offset=${offset}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error(`Clerk export failed (${response.status}); no output written`);
  const users = await response.json();
  if (!Array.isArray(users)) throw new Error('Unexpected Clerk users response');
  for (const user of users) {
    total++;
    const accounts = (user.external_accounts || []).filter(a => a.provider === 'oauth_google' && a.provider_user_id);
    if (accounts.length !== 1) { missingGoogle++; continue; }
    const google = accounts[0];
    if (Object.hasOwn(mapping, google.provider_user_id)) throw new Error('Duplicate Google account; inspect Clerk before migrating');
    mapping[google.provider_user_id] = user.id;
    if (hasAdminRole(user.public_metadata) || hasAdminRole(user.private_metadata)) {
      if (google.email_address) admins.add(google.email_address.toLowerCase());
    }
  }
  offset += users.length;
  if (users.length < 100) break;
}
const output = process.argv[2] || '.env.auth-migration.local';
await writeFile(output, `AUTH_LEGACY_USER_IDS='${JSON.stringify(mapping)}'\nAUTH_ADMIN_EMAILS=${[...admins].join(',')}\n`, { mode: 0o600, flag: 'wx' });
console.log(`Exported ${Object.keys(mapping).length}/${total} identities; ${admins.size} admin emails. Users requiring manual verification: ${missingGoogle}. Saved to ${output}. No Clerk data changed.`);
