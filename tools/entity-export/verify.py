#!/usr/bin/env python3
"""Validate prepared resources without Java or Minecraft."""
import hashlib, json, math, pathlib
root = pathlib.Path(__file__).resolve().parents[2]/'public/entity-preview/26.1.2'
manifest = json.loads((root/'manifest.json').read_text())
assert manifest['minecraft'] == '26.1.2'
for name, digest in manifest['files'].items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest() == digest, name

def parts(p):
    yield p
    for child in p['children'].values(): yield from parts(child)

stats = {}
for id in ['zombie','skeleton','horse','villager','ravager','zombie_baby','horse_baby','villager_baby']:
    data = json.loads((root/f'{id}--main.json').read_text())
    faces = [f for p in parts(data['root']) for f in p['faces']]
    assert faces, id
    for face in faces:
        assert len(face['vertices']) == 4
        assert abs(sum(n*n for n in face['normal'])-1) < 1e-5
        for v in face['vertices']:
            assert len(v)==5 and all(math.isfinite(n) for n in v)
            assert 0 <= v[3] <= 1 and 0 <= v[4] <= 1
    for pose in data['poses'].values():
        for transform in pose['parts'].values():
            assert all(math.isfinite(n) for field in transform.values() for n in field)
        if id in ['zombie','skeleton','zombie_baby']:
            assert set(pose['hands']) == {'mainhand','offhand'}
            assert all(len(matrix)==16 for matrix in pose['hands'].values())
    stats[id] = len(faces)
for id in ['zombie','skeleton','zombie_baby']:
    for slot in ['helmet','chestplate','leggings','boots']:
        armor = json.loads((root/f'{id}--{slot}.json').read_text())
        assert sum(len(p['faces']) for p in parts(armor['root'])) > 0
print(f"Verified {len(manifest['files'])} hashes, 8 bodies, 12 armor layers, pose and hand matrices.")
print('Body polygon counts:', stats)
