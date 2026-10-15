#!/usr/bin/env python3
"""Reproducible preparation from a locally installed vanilla Minecraft Java 26.1.2.
Usage: python3 tools/entity-export/export.py --minecraft-dir PATH --java JAVA25
No downloads, Java server, Gradle or Fabric installation required.
"""
import argparse, hashlib, json, pathlib, subprocess, tempfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
VERSION = '26.1.2'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--minecraft-dir', type=pathlib.Path, required=True)
    parser.add_argument('--java', default='java')
    parser.add_argument('--pack', type=pathlib.Path, action='append', default=[], help='Texture-only resource pack ZIP; later packs override earlier packs')
    parser.add_argument('--out', type=pathlib.Path, default=ROOT/'public/entity-preview'/VERSION)
    args = parser.parse_args()
    version_dir = args.minecraft_dir/'versions'/VERSION
    jar = version_dir/f'{VERSION}.jar'
    version = json.loads((version_dir/f'{VERSION}.json').read_text())
    if hashlib.sha1(jar.read_bytes()).hexdigest() != version['downloads']['client']['sha1']:
        raise ValueError('Client JAR does not match the launcher manifest; use an unmodified vanilla client')
    artifacts = [args.minecraft_dir/'libraries'/lib['downloads']['artifact']['path']
                 for lib in version['libraries'] if 'artifact' in lib.get('downloads', {})]
    # Native jars for other operating systems are irrelevant to a headless model bake.
    classpath = [jar] + [p for p in artifacts if p.exists()]
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='minecraft-bake-') as work:
        subprocess.run([args.java, '-cp', ':'.join(map(str, classpath)), str(ROOT/'tools/entity-export/ExportModels.java'), str(args.out.resolve())], cwd=work, check=True)
    manifest = {'format': 1, 'minecraft': VERSION, 'clientSha256': hashlib.sha256(jar.read_bytes()).hexdigest(), 'exporter': 'LayerDefinitions.createRoots().bakeRoot()', 'files': {}}
    with zipfile.ZipFile(jar) as z:
        for name in z.namelist():
            if not name.startswith('assets/minecraft/') or not name.endswith(('.png','.json')): continue
            path = name.removeprefix('assets/minecraft/')
            wanted = (path.startswith(('textures/entity/zombie/','textures/entity/skeleton/','textures/entity/horse/','textures/entity/villager/'))
                      or path == 'textures/entity/illager/ravager.png'
                      or path.startswith(('textures/entity/equipment/humanoid/', 'textures/entity/equipment/humanoid_baby/', 'textures/entity/equipment/humanoid_leggings/'))
                      or path.startswith(('equipment/',))
                      or path in ('models/item/generated.json','models/item/handheld.json','models/item/handheld_rod.json')
                      or path.startswith(('models/item/', 'items/')) and any(item in path for item in ('sword','axe','bow','stick'))
                      or path.startswith('textures/item/') and any(item in path for item in ('sword','axe','bow','stick')))
            if wanted:
                target = args.out/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(z.read(name))
    manifest['resourcePacks'] = []
    for pack in args.pack:
        with zipfile.ZipFile(pack) as z:
            if 'pack.mcmeta' not in z.namelist(): raise ValueError(f'Not a resource pack: {pack}')
            for name in z.namelist():
                if not name.startswith('assets/minecraft/textures/') or not name.endswith('.png'): continue
                relative = pathlib.PurePosixPath(name.removeprefix('assets/minecraft/'))
                if '..' in relative.parts: raise ValueError('Unsafe resource path')
                target = args.out/relative
                # Only replace textures selected from vanilla, no arbitrary pack code or geometry.
                if target.is_file():
                    import struct
                    data = z.read(name)
                    original = target.read_bytes()
                    w, h = struct.unpack('>II', data[16:24])
                    ow, oh = struct.unpack('>II', original[16:24])
                    if w * oh != h * ow: raise ValueError(f'Texture aspect ratio changed: {name}')
                    if name+'.mcmeta' in z.namelist(): raise ValueError(f'Animated pack textures are not supported: {name}')
                    target.write_bytes(data)
        manifest['resourcePacks'].append({'name': pack.name, 'sha256': hashlib.sha256(pack.read_bytes()).hexdigest()})
    # Canonical JSON makes hashes stable across JVM Map iteration orders.
    for path in args.out.rglob('*.json'):
        if path.name != 'manifest.json': path.write_text(json.dumps(json.loads(path.read_text()), sort_keys=True, separators=(',', ':'))+'\n')
    for path in sorted(args.out.rglob('*')):
        if path.is_file() and path.name != 'manifest.json': manifest['files'][path.relative_to(args.out).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    (args.out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f"Exported {len(manifest['files'])} files to {args.out}")

if __name__ == '__main__': main()
