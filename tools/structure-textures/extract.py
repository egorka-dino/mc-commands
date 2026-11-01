#!/usr/bin/env python3
"""Extract the pinned vanilla cube textures; no downloads or game execution.
Usage: python3 tools/structure-textures/extract.py --minecraft-dir PATH
"""
import argparse, hashlib, json, pathlib, zipfile
VERSION = '26.1.2'
# Verified against Mojang's version_manifest_v2.json and linked version metadata.
METADATA_URL = 'https://piston-meta.mojang.com/v1/packages/8f9f3c548c892ce41b78561138aeba112cba3490/26.1.2.json'
CLIENT_SHA1 = '4e618f09a0c649dde3fdf829df443ce0b8831e65'
NAMES = ['stone_bricks', 'stone', 'cobblestone', 'deepslate_bricks', 'oak_planks', 'bricks', 'quartz_block_side', 'quartz_block_top']
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--minecraft-dir', type=pathlib.Path, required=True)
args = parser.parse_args()
version_dir = args.minecraft_dir/'versions'/VERSION
metadata = json.loads((version_dir/f'{VERSION}.json').read_text())
client = metadata['downloads']['client']
jar = (version_dir/f'{VERSION}.jar').read_bytes()
assert hashlib.sha1(jar).hexdigest() == client['sha1'] == CLIENT_SHA1, 'Client differs from vanilla launcher metadata'
out = pathlib.Path(__file__).resolve().parents[2]/'public/structure-textures'/VERSION
out.mkdir(parents=True, exist_ok=True)
files = {}
with zipfile.ZipFile(version_dir/f'{VERSION}.jar') as archive:
    for name in NAMES:
        data = archive.read(f'assets/minecraft/textures/block/{name}.png')
        assert data[:8] == b'\x89PNG\r\n\x1a\n' and int.from_bytes(data[16:20], 'big') == 16 and int.from_bytes(data[20:24], 'big') == 16
        (out/f'{name}.png').write_bytes(data)
        files[f'{name}.png'] = hashlib.sha256(data).hexdigest()
    # Keep the vanilla face definitions as provenance for side/top/bottom selection.
    for name in ['quartz_block', 'cube_column', 'cube_all', 'cube']:
        data = archive.read(f'assets/minecraft/models/block/{name}.json')
        (out/f'{name}.json').write_bytes(data)
        files[f'{name}.json'] = hashlib.sha256(data).hexdigest()
manifest = {'minecraft': VERSION, 'source': 'Mojang vanilla Java client, assets/minecraft', 'metadataUrl': METADATA_URL, 'clientUrl': client['url'], 'clientSha1': client['sha1'], 'clientSha256': hashlib.sha256(jar).hexdigest(), 'files': files}
(out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Extracted {len(files)} files to {out}')
