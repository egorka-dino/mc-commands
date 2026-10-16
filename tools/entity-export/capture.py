#!/usr/bin/env python3
"""Capture Minecraft Java 26.1.2 CPU submissions, verify, then atomically replace the catalog. No GPU/window."""
import argparse,hashlib,json,pathlib,shutil,subprocess,tempfile
def run(command,**kwargs):
 result=subprocess.run(command,**kwargs)
 if result.returncode:raise SystemExit(result.returncode)
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--minecraft-dir',type=pathlib.Path,required=True)
p.add_argument('--java',default='java',help='Java 25 executable; javac must be alongside it')
p.add_argument('--out',type=pathlib.Path,default=ROOT/'public/entity-preview/26.1.2/catalog')
a=p.parse_args();r=a.minecraft_dir;version='26.1.2'
v=json.loads((r/f'versions/{version}/{version}.json').read_text());jar=r/f'versions/{version}/{version}.jar'
assert hashlib.sha1(jar.read_bytes()).hexdigest()==v['downloads']['client']['sha1'],'Client JAR differs from launcher metadata'
cp=[jar]+[r/'libraries'/l['downloads']['artifact']['path'] for l in v['libraries'] if 'artifact' in l.get('downloads',{})]
source=ROOT/'tools/entity-export';target=a.out.resolve();target.parent.mkdir(parents=True,exist_ok=True)
run(['node',str(source/'export-catalog.mjs')],cwd=ROOT)
with tempfile.TemporaryDirectory(prefix='mc-capture-') as work,tempfile.TemporaryDirectory(prefix='.mc-catalog-',dir=target.parent) as staging:
 classpath=':'.join(str(p) for p in cp if p.exists())
 run([str(pathlib.Path(a.java).with_name('javac')),'-cp',classpath,'-d',work,str(source/'CaptureScenes.java'),str(source/'VanillaAssets.java')])
 run([a.java,'--enable-native-access=ALL-UNNAMED','-Djava.library.path='+str(r/f'versions/{version}/natives'),'-cp',work+':'+classpath,'CaptureScenes',str(source/'catalog.json'),str(source/'default-textures.json'),staging,str(jar)],cwd=work)
 out=pathlib.Path(staging)
 run(['python3',str(source/'verify-catalog.py'),'--root',str(out)])
 manifest={'format':3,'minecraft':version,'clientSha1':v['downloads']['client']['sha1'],'clientSha256':hashlib.sha256(jar.read_bytes()).hexdigest(),'exporterSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in [source/'CaptureScenes.java',source/'VanillaAssets.java',source/'catalog.json',source/'default-textures.json',source/'capture.py',source/'export-catalog.mjs']},'files':{str(f.relative_to(out)):hashlib.sha256(f.read_bytes()).hexdigest()for f in sorted(out.rglob('*'))if f.is_file()}}
 (out/'manifest.json').write_text(json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n')
 # Preserve the previous verified export until the replacement passes the full audit.
 backup=target.with_name(target.name+'.previous')
 if backup.exists():raise RuntimeError(f'Previous backup exists: {backup}')
 if target.exists():target.rename(backup)
 try:shutil.move(str(out),str(target))
 except BaseException:
  if backup.exists():backup.rename(target)
  raise
 if backup.exists():shutil.rmtree(backup)
print('Verified catalog:',target)
