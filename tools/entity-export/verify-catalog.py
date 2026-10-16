#!/usr/bin/env python3
"""Strict, Java-free audit of catalog completeness, references, textures and vertex data."""
import argparse, hashlib, json, math, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--root',type=pathlib.Path,default=ROOT/'public/entity-preview/26.1.2/catalog')
a=p.parse_args();root=a.root
catalog=json.loads((ROOT/'tools/entity-export/catalog.json').read_text())
report=json.loads((root/'report.json').read_text())
assert set(report['entities'])==set(catalog['entities'])
items=set(item for slot in catalog['slots'] for item in slot['items'])
assert set(report['items'])==items
for group in ['entities','items']:
 for id,entry in report[group].items():assert 'error' not in entry,(id,entry)
refs=set();poses=0;equipment=0
for id in catalog['entities']:
 model=json.loads((root/f'entities/{id}.json').read_text())
 assert model['format']==3 and model['minecraft']=='26.1.2'
 expected={(('baby-' if baby else '')+pose+str(held)) for baby in range(2 if id in catalog['babyEntities'] else 1) for pose in ['standing','riding']for held in range(4)}
 if id=='pillager':expected.update({pose+str(held)+'-crossbow' for pose in ['standing','riding'] for held in range(1,4)})
 assert math.isfinite(model['defaultScale']) and model['defaultScale']>0,id
 assert set(model['poses'])==expected,id
 assert all(len(model[key])==3 and all(math.isfinite(n)for n in model[key])for key in ['passenger','vehicle'])
 for key,pose in model['poses'].items():
  poses+=1;assert bool(pose['body'])==(id!='area_effect_cloud'),(id,key)
  refs.update(pose['body'])
  for attachment in pose['attachments'].values():
   assert len(attachment['matrix'])==16 and all(math.isfinite(n)for n in attachment['matrix'])
  for slot,variants in pose['equipment'].items():
   assert set(variants)<=set(next(s['items']for s in catalog['slots']if s['key']==slot))
   for meshes in variants.values():assert meshes;refs.update(meshes);equipment+=1
for item in items:
 contexts=json.loads((root/f'items/{item}.json').read_text())
 assert set(contexts)=={'GROUND','THIRD_PERSON_RIGHT_HAND','THIRD_PERSON_LEFT_HAND'}
 for meshes in contexts.values():assert meshes,item;refs.update(meshes)
vertices=0;textures=set()
for ref in refs:
 mesh=json.loads((root/f'meshes/{ref}.json').read_text())
 assert len(mesh['vertices'])%4==0 and mesh['vertices'],ref
 assert any(v[11]>0 for v in mesh['vertices']),('Fully transparent geometry',ref)
 for v in mesh['vertices']:assert len(v)==12 and all(math.isfinite(n)for n in v),(ref,v)
 vertices+=len(mesh['vertices'])
 if mesh.get('texture'):
  texture=mesh['texture'].removeprefix('minecraft:');assert 'missingno' not in texture,ref
  assert (root/texture).is_file(),texture;textures.add(texture)
manifest=root/'manifest.json'
if manifest.exists():
 data=json.loads(manifest.read_text())
 for name,digest in data['files'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
print(json.dumps({'entities':len(catalog['entities']),'geometricEntities':len(catalog['entities'])-1,'particleOnlyEntities':1,'items':len(items),'poses':poses,'equipmentVariants':equipment,'meshes':len(refs),'vertices':vertices,'referencedTextures':len(textures)},indent=2))
