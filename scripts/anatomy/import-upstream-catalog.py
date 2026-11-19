"""Extract names/types only; do not import upstream exercise/clinical descriptions."""
import hashlib
import json
import re
import sys
from pathlib import Path
from opencc import OpenCC

source, destination, revision = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
destination.mkdir(parents=True, exist_ok=True)
data = json.loads((source / 'anatomy_map.json').read_text(encoding='utf8'))
convert = OpenCC('s2twp')
items = []
for ident, record in data.items():
    name = convert.convert(record['cn']).replace('岡上肌', '棘上肌').replace('岡下肌', '棘下肌')
    english = record['en']
    side = 'left' if re.match(r'^(Left|L)\s', english, re.I) else 'right' if re.match(r'^(Right|R)\s', english, re.I) else 'midline'
    path = source / 'models' / record['file']
    if path.parent != source / 'models' or not path.is_file(): raise ValueError(f'Missing or invalid model: {ident}')
    if record['type'] not in {'bone', 'muscle'} or record['region'] not in {'head', 'torso', 'upper', 'lower'}: raise ValueError(ident)
    items.append(dict(id=ident, name=name, english=english, type=record['type'], zone=record['region'], location={'left':'左側','right':'右側','midline':'中線／未標側別'}[side], side=side, file=record['file'], sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
items.sort(key=lambda item: (item['type'] != 'muscle', item['english'].lower(), item['id']))
manifest = dict(repository='https://github.com/zhangguanghao523/muscle-atlas-3d', revision=revision, sourceLicense='CC BY-SA 2.1 Japan', muscleCount=sum(i['type']=='muscle' for i in items), boneCount=sum(i['type']=='bone' for i in items), items=items)
(destination / 'catalog.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
(destination / 'UPSTREAM_README.md').write_bytes((source / 'README.md').read_bytes())
print(f'Catalog: {len(items)} structures, {manifest["muscleCount"]} muscles / {manifest["boneCount"]} bones')
