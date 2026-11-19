import bpy
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / 'frontend/apps/frontend/src/assets/anatomy/Z-Anatomy_Muscles_Interactive_Zones.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
def bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return [[round(min(p[i] for p in points), 4) for i in range(3)], [round(max(p[i] for p in points), 4) for i in range(3)]]
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
print('INSPECT_COUNT', len(meshes))
for obj in meshes:
    if any(name in obj.name.lower() for name in ['gluteus medius', 'pectoralis', 'frontalis', 'rectus femoris', 'opponens pollicis', 'adductor hallucis']):
        print('INSPECT_OBJECT', obj.name, 'PARENT', obj.parent.name if obj.parent else None, 'BOUNDS', bounds(obj), 'POLYS', len(obj.data.polygons))
print('INSPECT_SAMPLE', [(obj.name, obj.parent.name if obj.parent else None) for obj in meshes[:8]])
