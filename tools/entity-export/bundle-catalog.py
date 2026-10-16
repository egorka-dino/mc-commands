#!/usr/bin/env python3
"""Package prepared assets for source-upload APIs with a small request-body limit."""
import argparse,base64,gzip,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=pathlib.Path,required=True)
a=p.parse_args();catalog=root/'public/entity-preview/26.1.2/catalog'
assert (catalog/'manifest.json').is_file(),'Run capture.py first'
data={'format':1,'minecraft':'26.1.2','files':{str(f.relative_to(catalog)):base64.b64encode(f.read_bytes()).decode()for f in sorted(catalog.rglob('*'))if f.is_file()}}
a.out.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),compresslevel=9,mtime=0))
print(len(data['files']),'files;',a.out.stat().st_size,'bytes')
