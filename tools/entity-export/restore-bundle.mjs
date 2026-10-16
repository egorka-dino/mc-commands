// Optional build-only transport for API deployments. Normal Git deployments already contain the catalog.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, isAbsolute } from 'node:path';
const bundle = resolve('entity-preview-bundle.json.gz');
if (existsSync(bundle)) {
  const data = JSON.parse(gunzipSync(readFileSync(bundle), { maxOutputLength: 64 * 1024 * 1024 }));
  if (data.format !== 1 || data.minecraft !== '26.1.2') throw Error('Unsupported preview bundle');
  const files = new Map(Object.entries(data.files).map(([path, value]) => {
    if (isAbsolute(path) || path.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw Error('Invalid asset path');
    return [path, Buffer.from(value, 'base64')];
  }));
  const manifest = JSON.parse(files.get('manifest.json')?.toString() || 'null');
  if (manifest?.format !== 3 || manifest.minecraft !== '26.1.2' || files.size !== Object.keys(manifest.files).length + 1) throw Error('Incomplete preview bundle');
  for (const [path, sha] of Object.entries(manifest.files)) {
    const bytes = files.get(path);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== sha) throw Error(`Preview checksum mismatch: ${path}`);
  }
  const target = resolve('public/entity-preview/26.1.2/catalog');
  mkdirSync(dirname(target), { recursive: true });
  const staging = mkdtempSync(join(dirname(target), '.restore-'));
  try {
    for (const [path, bytes] of files) { const file = join(staging, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
    rmSync(target, { recursive: true, force: true }); renameSync(staging, target);
  } finally { rmSync(staging, { recursive: true, force: true }); }
  console.log(`Restored ${files.size} verified Minecraft preview assets`);
}
