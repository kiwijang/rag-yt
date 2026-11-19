"""Compare exported active muscle point sets with the actual source blend.
Run in Blender background with --disable-autoexec. Does not save any blend file.
"""
import bpy, hashlib, json, re, sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[sys.argv.index('--')+1])
assets=root/'frontend/apps/frontend/src/assets/anatomy/startup-reconciled'
manifest=json.loads((assets/'catalog.json').read_text(encoding='utf8'))
digest=hashlib.sha256(source.read_bytes()).hexdigest()
assert digest==manifest['source']['sha256']
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
deps=bpy.context.evaluated_depsgraph_get()
expected={}
for item in manifest['items']:
    if item['source']!='Z-Anatomy Startup':continue
    obj=bpy.data.objects[item['sourceObjectName']]
    if item['type']=='bone':
        assert obj.name in json.loads((root/'scripts/anatomy/startup-head-bones.json').read_text(encoding='utf8')).values()
    else:
        assert any(c.name=='Muscles' for c in obj.users_collection)
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
    used={i for face in mesh.polygons for i in face.vertices}
    expected[item['id']]=[obj.matrix_world @ mesh.vertices[i].co for i in used]
    evaluated.to_mesh_clear()
assert len(expected)==486
scene=bpy.data.scenes.new('Verification only');bpy.context.window.scene=scene
bpy.ops.import_scene.gltf(filepath=str(assets/'atlas.glb'))
bpy.context.view_layer.update()
shift=manifest['registration']['translationMetres'];shift=Vector((shift[0],-shift[2],shift[1]))
actual={}
for obj in scene.objects:
    if obj.type!='MESH' or obj.get('source')!='Z-Anatomy Startup':continue
    used={i for face in obj.data.polygons for i in face.vertices}
    actual.setdefault(obj['anatomyId'],[]).extend(obj.matrix_world @ obj.data.vertices[i].co-shift for i in used)
assert set(actual)==set(expected)
def tree(points):
    result=KDTree(len(points))
    for i,p in enumerate(points):result.insert(p,i)
    result.balance();return result
maximum=0
for key in expected:
    old,new=expected[key],actual[key];a,b=tree(old),tree(new)
    error=max(max(a.find(p)[2] for p in new),max(b.find(p)[2] for p in old))
    assert error<.000002,(key,error)
    maximum=max(maximum,error)
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
print('STARTUP_GEOMETRY_PASS',json.dumps(dict(objects=len(expected),maxErrorMetres=maximum,sourceUnchanged=True)),flush=True)


