#!/usr/bin/env python3
"""Run the pinned upstream bytecode extractor without its image renderer."""
import argparse, hashlib, json, os, pathlib, shutil, subprocess
PIN = '2b69cd3464080dcb633038bd8d68a85201e75268'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--upstream', type=pathlib.Path, required=True)
p.add_argument('--minecraft-dir', type=pathlib.Path, required=True)
p.add_argument('--java-home', type=pathlib.Path, required=True, help='JDK 21; this is the upstream tooling requirement')
p.add_argument('--out', type=pathlib.Path, required=True)
a = p.parse_args()
if not a.upstream.exists(): subprocess.run(['git','clone','https://github.com/minecraft-library/asset-renderer.git',str(a.upstream)],check=True)
actual = subprocess.check_output(['git','-C',str(a.upstream),'rev-parse','HEAD'],text=True).strip()
if actual != PIN: raise SystemExit(f'Expected upstream commit {PIN}, got {actual}; checkout the pinned revision first')
source = a.upstream/'tooling/src/main/java/lib/minecraft/renderer/tooling/run/ToolingPipeline.java'
s = source.read_text()
old = 'ClientOptions options = ClientOptions.defaults();'
new = 'ClientOptions options = ClientOptions.builder().version("26.1.2").build();'
if old not in s and new not in s: raise SystemExit('Upstream acquisition entry point changed; review before patching')
source.write_text(s.replace(old,new))
jar = a.minecraft_dir/'versions/26.1.2/26.1.2.jar'
cache = a.upstream/'cache/asset-renderer/vanilla/26.1.2/client.jar'; cache.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(jar,cache)
a.out.mkdir(parents=True,exist_ok=True)
subprocess.run(['bash','./gradlew',':tooling:entityModels',f'-PtoolingOut={a.out.resolve()}','--console=plain'],cwd=a.upstream,env={**os.environ,'JAVA_HOME':str(a.java_home)},check=True)
models = json.loads((a.out/'entity_models.json').read_text())
geometry = json.loads((a.out/'entity_geometry.json').read_text())
poses = json.loads((a.out/'entity_poses.json').read_text())
report = {'upstreamCommit':PIN,'sourceVersion':models['source_version'],'clientSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),
          'modelRows':len(models['models']),'geometries':len(geometry['geometries']),'poses':len(poses['poses']),'animationClips':len(poses['clips']),'slice':{}}
for entity in ['zombie','skeleton','horse','villager','ravager']:
    row = models['models']['minecraft:'+entity]; adult = row['axes']['age']['options']['adult']; mesh = geometry['geometries'][adult['geometry']]
    report['slice'][entity] = {'adult':adult,'bones':len(mesh['bones']),'cubes':sum(len(b.get('cubes',[])) for b in mesh['bones'].values()),'axes':list(row['axes']),'armor':row.get('armor'),'overlays':row.get('overlays',[])}
(a.out/'research-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
