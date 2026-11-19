"""Read-only Blender inventory. Never saves the source blend file."""
import bpy, hashlib, json, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index('--')+1:]
source = Path(args[0])
output = ROOT / 'models/startup-audit'
output.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
rows = []
for obj in bpy.data.objects:
    parents = []
    parent = obj.parent
    while parent:
        parents.append(parent.name)
        parent = parent.parent
    row = dict(name=obj.name, type=obj.type, parent=obj.parent.name if obj.parent else None,
               parents=parents, collections=[c.name for c in obj.users_collection],
               properties={key:str(value)[:300] for key,value in obj.items() if key not in {'_RNA_UI'}},
               location=list(obj.matrix_world.translation), hideRender=obj.hide_render)
    if obj.type == 'MESH':
        points=[obj.matrix_world @ Vector(p) for p in obj.bound_box]
        row.update(vertices=len(obj.data.vertices),polygons=len(obj.data.polygons),mesh=obj.data.name,
                   bounds=dict(min=[min(p[i] for p in points) for i in range(3)],max=[max(p[i] for p in points) for i in range(3)]),
                   materials=[slot.material.name if slot.material else None for slot in obj.material_slots])
    rows.append(row)
result=dict(sourceFile=source.name,sha256=source_hash,blender=bpy.app.version_string,
            units=dict(system=bpy.context.scene.unit_settings.system,scale=bpy.context.scene.unit_settings.scale_length),
            collections=[dict(name=c.name,children=[x.name for x in c.children],objects=len(c.objects)) for c in bpy.data.collections],
            objects=rows)
(output/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
print('STARTUP_INVENTORY',json.dumps(dict(objects=len(rows),meshes=sum(r['type']=='MESH' for r in rows),sha256=source_hash)))
