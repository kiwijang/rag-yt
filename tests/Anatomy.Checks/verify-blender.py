"""Run with Blender --background --factory-startup --python this_file.py.
Checks real exported anatomy against the unchanged input, not mock geometry.
"""
import bpy
import re
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend/apps/frontend/src/assets/anatomy'
def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
def points(obj):
    used = {i for face in obj.data.polygons for i in face.vertices}
    return [obj.matrix_world @ obj.data.vertices[index].co for index in used]
def tree(points):
    index = KDTree(len(points))
    for i, point in enumerate(points): index.insert(point, i)
    index.balance()
    return index

clear()
bpy.ops.import_scene.gltf(filepath=str(ASSETS / 'Z-Anatomy_Muscles_Interactive_Zones.glb'))
reference = {obj.name: points(obj) for obj in bpy.context.scene.objects if obj.type == 'MESH' and not re.search(r'\.[gj](?:\.\d+)?$', obj.name)}
assert len(reference) == 687
clear()
bpy.ops.import_scene.gltf(filepath=str(ASSETS / 'MuscleAtlas_Anatomy.glb'))
seen = set()
maximum = 0.0
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH': continue
    name = obj['originalNodeName']
    assert name in reference, name
    original, exported = reference[name], points(obj)
    old_index, new_index = tree(original), tree(exported)
    # Both directions: catch both moved vertices and removed original features.
    error = max(max(old_index.find(point)[2] for point in exported), max(new_index.find(point)[2] for point in original))
    assert error < .000002, (name, error)
    maximum = max(maximum, error)
    assert re.search('[\u3400-\u9fff]', obj['anatomyNameZh']), name
    seen.add(name)
assert seen == set(reference)

bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'models/blender/muscle-atlas.blend'))
scene = bpy.context.scene
bpy.context.window.view_layer = scene.view_layers['Exploded Anatomy']
parts = [obj for obj in scene.objects if obj.get('atlasRole') in {'muscle', 'support'}]
assert len(parts) == 687
scene['Explosion'] = 0
for obj in parts: obj.hide_set(False)
scene.update_tag(); scene.frame_set(1); bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
base = {obj.name: obj.evaluated_get(graph).location.copy() for obj in parts}
scene['Explosion'] = 100
scene.update_tag(); scene.frame_set(2); bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
for obj in parts:
    assert abs((obj.evaluated_get(graph).location-base[obj.name]).length-.48) < .000001, obj.name
    assert re.search('[\u3400-\u9fff]', obj['anatomyNameZh'])
scene['Explosion'] = 0
scene.update_tag(); scene.frame_set(3); bpy.context.view_layer.update()
graph = bpy.context.evaluated_depsgraph_get()
for obj in parts: assert (obj.evaluated_get(graph).location-base[obj.name]).length < .000001
print(f'PASS: 687 original anatomical point clouds preserved (max deviation {maximum:.9f} m), bilingual metadata, Blender 0/100/0 explosion drivers. No input files modified.', flush=True)
