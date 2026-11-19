"""Blender 5.1 background build. Creates derived assets; never edits the input GLB.

blender --background --factory-startup --python scripts/anatomy/build-muscle-atlas.py
"""
import bpy
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import convex_hull_2d

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'frontend/apps/frontend/src/assets/anatomy'
SOURCE = ASSETS / 'Z-Anatomy_Muscles_Interactive_Zones.glb'
WORK = ROOT / 'models/blender'
WORK.mkdir(parents=True, exist_ok=True)
LABELS = dict(re.findall(r"^  '([^']+)': '([^']+)',", (ROOT / 'frontend/apps/frontend/src/app/pages/muscles-page/anatomy-labels.zh-Hant.ts').read_text(encoding='utf8'), re.MULTILINE))

def configure_blender_explosion():
    scene = bpy.context.scene
    scene['Explosion'] = 0.0
    scene.id_properties_ui('Explosion').update(min=0.0, max=100.0, soft_min=0.0, soft_max=100.0, description='Muscle exploded-view amount. Show Exploded_Anatomy and hide Smooth_Surface to inspect.')
    objects = [obj for obj in scene.objects if obj.get('atlasRole') in {'muscle', 'support'}]
    for obj in objects:
        obj['anatomyNameZh'] = LABELS.get(obj['anatomyId'], obj['anatomyId'])
        obj['anatomyNameEn'] = obj['anatomyId']
        if 'atlasBaseLocation' in obj:
            obj.driver_remove('location')
            obj.location = Vector(obj['atlasBaseLocation'])
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    center = Vector([(min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)])
    for obj in objects:
        base = obj.location.copy()
        obj['atlasBaseLocation'] = list(base)
        part_center = sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8
        direction = part_center - center
        direction.z *= .25; direction.y *= 1.4
        if direction.length_squared < .00001: direction = Vector((0, 1, 0))
        direction.normalize(); direction *= .48
        for axis in range(3):
            driver = obj.driver_add('location', axis).driver
            driver.type = 'SCRIPTED'
            driver.expression = f'{base[axis]:.12f} + ({direction[axis]:.12f}) * amount / 100'
            variable = driver.variables.new(); variable.name = 'amount'; variable.type = 'SINGLE_PROP'
            variable.targets[0].id_type = 'SCENE'; variable.targets[0].id = scene
            variable.targets[0].data_path = '["Explosion"]'
    normal_layer = scene.view_layers[0]
    normal_layer.name = 'Smooth Surface'
    exploded_layer = scene.view_layers.get('Exploded Anatomy') or scene.view_layers.new('Exploded Anatomy')
    for layer in [normal_layer, exploded_layer]:
        for name in ['Smooth_Surface', 'Exploded_Anatomy']:
            layer.layer_collection.children[name].exclude = False
        layer.update()
        for obj in scene.objects:
            if obj.get('atlasRole') and obj.name in layer.objects:
                obj.hide_set(False, view_layer=layer)
                obj.hide_render = False
    normal_layer.layer_collection.children['Exploded_Anatomy'].exclude = True
    exploded_layer.layer_collection.children['Smooth_Surface'].exclude = True
    normal_layer.use = True
    exploded_layer.use = False  # Preview render uses only the surface layer.
    return len(objects)

if '--configure-existing' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(WORK / 'muscle-atlas.blend'))
    bpy.context.preferences.filepaths.save_version = 0
    count = configure_blender_explosion()
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'muscle-atlas.blend'))
    print('ATLAS_BUILD Blender explosion drivers configured:', count, flush=True)
    sys.exit(0)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(SOURCE))

def log(*args):
    print('ATLAS_BUILD', *args, flush=True)

def structure_name(name):
    return re.sub(r'\.(?:l|r)(?:\.\d+)?$', '', name).strip()

def helper(name):
    return re.search(r'\.[gj](?:\.\d+)?$', name) is not None

def is_muscle(name):
    lower = name.lower()
    return not any(word in lower for word in ['bursa', 'bursae', 'fascia', 'tendon', 'retinaculum', 'aponeurosis', 'sheath', 'raphe', 'linea', 'tarsus'])

COLORS = {
    'skin': '#d8b49c', 'chest': '#c95862', 'shoulder': '#478fa1', 'upper_arm': '#507dab',
    'triceps': '#946898', 'forearm': '#8880b3', 'abdomen': '#5d9b62', 'oblique': '#bba354',
    'quadriceps': '#537bad', 'adductor': '#ad6d84', 'calf': '#63978b', 'glute': '#9a6b9d',
    'back': '#5f94a0', 'trapezius': '#be6c79', 'hamstring': '#766a9d', 'anatomy': '#bd7776',
}

def palette(name):
    n = name.lower()
    if not is_muscle(name): return 'skin'
    rules = [
        ('pectoralis', 'chest'), ('deltoid', 'shoulder'), ('biceps brachii', 'upper_arm'),
        ('triceps brachii', 'triceps'), ('rectus abdominis', 'abdomen'), ('abdominal oblique', 'oblique'),
        ('transversus abdominis', 'oblique'), ('gluteus', 'glute'), ('latissimus', 'back'),
        ('trapezius', 'trapezius'), ('vastus', 'quadriceps'), ('rectus femoris', 'quadriceps'),
        ('adductor', 'adductor'), ('sartorius', 'adductor'), ('gracilis', 'adductor'),
        ('biceps femoris', 'hamstring'), ('semitendinosus', 'hamstring'), ('semimembranosus', 'hamstring'),
        ('gastrocnemius', 'calf'), ('soleus', 'calf'), ('tibialis anterior', 'calf'),
        ('brachioradialis', 'forearm'), ('carpi', 'forearm'), ('pronator', 'forearm'), ('anconeus', 'forearm'),
    ]
    for word, color in rules:
        if word in n: return color
    return 'skin'

def linear(v): return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
def material(name, color):
    rgb = [linear(int(color[i:i+2], 16)/255) for i in [1, 3, 5]]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .68
    bsdf.inputs['Metallic'].default_value = 0
    return m

MATERIALS = {key: material('Atlas_' + key, color) for key, color in COLORS.items()}
originals = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not helper(o.name)]
log('original anatomy objects', len(originals))

# Store precise IDs from original English node names, independent of re-exported node order.
anatomy_collection = bpy.data.collections.new('Exploded_Anatomy')
bpy.context.scene.collection.children.link(anatomy_collection)
anatomy = []
world_vertices, world_faces, face_sources = [], [], []
envelope_vertices, envelope_faces = [], []
support_points = defaultdict(list)
for obj in originals:
    ident = structure_name(obj.name)
    world = obj.matrix_world.copy()
    vertices = [world @ vertex.co for vertex in obj.data.vertices]
    # Derive every support core from the original muscles' cross-sections.
    # Unlike arbitrary ellipsoids, these inset hulls cannot enlarge the source
    # silhouette at the sampled heights. They only close internal skin gaps.
    n = ident.lower()
    if is_muscle(ident):
        if any(word in n for word in ['pectoralis', 'abdominis', 'abdominal oblique', 'latissimus', 'trapezius', 'serratus', 'gluteus']):
            support_points['torso'].extend(p for p in vertices if .80 < p.z < 1.44)
        thigh_adductor = n in {'adductor brevis', 'adductor longus', 'adductor magnus', '(adductor minimus)'}
        if thigh_adductor or any(word in n for word in ['vastus', 'rectus femoris', 'biceps femoris', 'semitendinosus', 'semimembranosus', 'sartorius', 'gracilis']):
            for sign in [-1, 1]: support_points[f'thigh{sign}'].extend(p for p in vertices if .35 < p.z < .95 and p.x*sign > 0)
        if any(word in n for word in ['gastrocnemius', 'soleus', 'tibialis', 'fibularis', 'digitorum longus', 'hallucis longus']):
            for sign in [-1, 1]: support_points[f'calf{sign}'].extend(p for p in vertices if .065 < p.z < .46 and p.x*sign > 0)
    offset = len(envelope_vertices)
    envelope_vertices.extend(vertices)
    envelope_faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
    if is_muscle(ident):
        offset = len(world_vertices)
        world_vertices.extend(vertices)
        world_faces.extend(tuple(offset+i for i in face.vertices) for face in obj.data.polygons)
        face_sources.extend([len(anatomy)] * len(obj.data.polygons))
    obj['anatomyId'] = ident
    obj['atlasRole'] = 'muscle' if is_muscle(ident) else 'support'
    obj['originalNodeName'] = obj.name
    obj['anatomyNameZh'] = LABELS[ident]
    obj['anatomyNameEn'] = ident
    # Flatten the export hierarchy so a parent never hides/moves an unrelated child.
    obj.parent = None
    obj.matrix_world = world
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    anatomy_collection.objects.link(obj)
    anatomy.append(obj)

source_bvh = BVHTree.FromPolygons(world_vertices, world_faces, all_triangles=False)
log('source BVH ready', len(world_faces))

# A continuous visual skin envelope. Additional closed volumes fill cavities of
# the muscle-only source atlas (cranium, thorax, abdomen, pelvis and palms).
surface_collection = bpy.data.collections.new('Smooth_Surface')
bpy.context.scene.collection.children.link(surface_collection)
mesh = bpy.data.meshes.new('SkinEnvelope_Source')
mesh.from_pydata(envelope_vertices, [], envelope_faces)
mesh.update()
body = bpy.data.objects.new('SkinEnvelope', mesh)
surface_collection.objects.link(body)
del envelope_vertices, envelope_faces, world_vertices, world_faces

def ellipsoid(name, center, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    surface_collection.objects.link(obj)
    return obj

volumes = [body,
    ellipsoid('Cranium_Skin', (0, -.006, 1.59), (.071, .086, .111)),
    ellipsoid('Face_Skin', (0, -.050, 1.555), (.054, .057, .067)),
    ellipsoid('Nose_Skin', (0, -.106, 1.565), (.012, .019, .024)),
]

def original_fitted_core(name, points):
    if not points: return None
    rings = []
    z = min(p.z for p in points) + .008
    maximum = max(p.z for p in points) - .008
    while z <= maximum:
        section = [Vector((p.x, p.y)) for p in points if abs(p.z-z) < .010]
        if len(section) >= 8:
            hull = [section[i] for i in convex_hull_2d(section)]
            if len(hull) >= 3:
                center = sum(hull, Vector((0, 0))) / len(hull)
                ring = []
                for k in range(48):
                    ray = Vector((math.cos(k*2*math.pi/48), math.sin(k*2*math.pi/48)))
                    hits = []
                    for a, b in zip(hull, hull[1:]+hull[:1]):
                        edge, delta = b-a, a-center
                        determinant = ray.x*edge.y-ray.y*edge.x
                        if abs(determinant) < 1e-10: continue
                        distance = (delta.x*edge.y-delta.y*edge.x)/determinant
                        u = (delta.x*ray.y-delta.y*ray.x)/determinant
                        if distance > 0 and -.0001 <= u <= 1.0001: hits.append(distance)
                    radius = min(hits) if hits else 0
                    p = center + ray*radius*.975
                    ring.append((p.x, p.y, z))
                rings.append(ring)
        z += .016
    if len(rings) < 2: return None
    vertices = [p for ring in rings for p in ring]
    faces = []
    for row in range(len(rings)-1):
        for k in range(48): faces.append((row*48+k, row*48+(k+1)%48, (row+1)*48+(k+1)%48, (row+1)*48+k))
    faces.extend([tuple(reversed(range(48))), tuple((len(rings)-1)*48+k for k in range(48))])
    core_mesh = bpy.data.meshes.new(name)
    core_mesh.from_pydata(vertices, [], faces); core_mesh.update()
    core = bpy.data.objects.new(name, core_mesh); surface_collection.objects.link(core)
    return core

for name, points in support_points.items():
    core = original_fitted_core('SourceFitted_'+name, points)
    if core: volumes.append(core)
for sign in [-1, 1]:
    volumes.append(ellipsoid('Ear_Skin', (sign*.066, -.002, 1.578), (.014, .018, .031)))
    volumes.append(ellipsoid('Palm_Skin', (sign*.295, -.026, .814), (.025, .019, .047)))
    volumes.append(ellipsoid('Foot_Skin', (sign*.089, -.025, .037), (.039, .085, .026)))

bpy.ops.object.select_all(action='DESELECT')
for obj in volumes: obj.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
body.data.remesh_voxel_size = .0032
body.data.use_remesh_preserve_volume = True
bpy.ops.object.voxel_remesh()
log('voxel envelope', len(body.data.polygons), 'faces')
smooth = body.modifiers.new('Smooth skin contour', 'SMOOTH')
smooth.factor = 1.0
smooth.iterations = 14
bpy.ops.object.modifier_apply(modifier=smooth.name)
decimate = body.modifiers.new('Web mesh optimisation', 'DECIMATE')
decimate.ratio = .60
bpy.ops.object.modifier_apply(modifier=decimate.name)
for face in body.data.polygons: face.use_smooth = True
body.data.update()

# Project original muscle membership onto the smooth surface; do not invent IDs.
assignments = []
rectus = {sign: next(i for i, obj in enumerate(anatomy) if obj['anatomyId'] == 'Rectus abdominis muscle' and (obj.name.endswith('.l') if sign > 0 else obj.name.endswith('.r'))) for sign in [-1, 1]}
tibialis = {sign: next(i for i, obj in enumerate(anatomy) if obj['anatomyId'] == 'Tibialis anterior muscle' and (obj.name.endswith('.l') if sign > 0 else obj.name.endswith('.r'))) for sign in [-1, 1]}
for face in body.data.polygons:
    center = face.center
    index = -1
    if .12 < center.z < 1.47 and not (abs(center.x) > .25 and center.z < .90):
        point, normal, source_face, distance = source_bvh.find_nearest(center)
        if source_face is not None and distance < .040:
            candidate = face_sources[source_face]
            if palette(anatomy[candidate]['anatomyId']) != 'skin': index = candidate
    # A deliberately simplified rectus overlay, grouped under the exact original
    # rectus IDs. These coloured surface patches are visual guides, not dissection geometry.
    if .99 < center.z < 1.235 and .006 < abs(center.x) < .052 and center.y < -.045 and face.normal.y < -.25:
        row = (center.z - .99) % .061
        width = .052 * math.sqrt(max(0, 1 - ((row - .0305) / .0305) ** 2))
        index = rectus[1 if center.x > 0 else -1] if .006 < row < .054 and abs(center.x) < width else -1
    if .145 < center.z < .365 and abs(abs(center.x)-.086) < .035 and center.y < -.025 and face.normal.y < -.35:
        index = tibialis[1 if center.x > 0 else -1]
    assignments.append(index)

neighbors = [set() for _ in body.data.polygons]
edge_faces = defaultdict(list)
for face in body.data.polygons:
    for edge in face.edge_keys: edge_faces[edge].append(face.index)
for faces in edge_faces.values():
    for index in faces: neighbors[index].update(other for other in faces if other != index)
# Regularise the projected boundaries, then leave a narrow skin-coloured seam.
for _ in range(8):
    assignments = [Counter([assignments[i]] + [assignments[n] for n in neighbors[i]]).most_common(1)[0][0] for i in range(len(assignments))]
for _ in range(1):
    assignments = [value if all(assignments[n] == value for n in neighbors[i]) else -1 for i, value in enumerate(assignments)]

faces_by_source = defaultdict(list)
for face, source_index in zip(body.data.polygons, assignments): faces_by_source[source_index].append(face)
surface_objects = []
for source_index, faces in faces_by_source.items():
    used = sorted({vertex for face in faces for vertex in face.vertices})
    remap = {old: new for new, old in enumerate(used)}
    patch_mesh = bpy.data.meshes.new('SmoothPatch')
    patch_mesh.from_pydata([body.data.vertices[index].co for index in used], [], [tuple(remap[v] for v in face.vertices) for face in faces])
    patch_mesh.update()
    ident = anatomy[source_index]['anatomyId'] if source_index >= 0 else ''
    patch = bpy.data.objects.new('Surface_' + (anatomy[source_index].name if source_index >= 0 else 'Skin'), patch_mesh)
    surface_collection.objects.link(patch)
    patch['anatomyId'] = ident
    patch['atlasRole'] = 'surface' if ident else 'skin'
    patch['anatomyNameZh'] = LABELS[ident] if ident else '外皮'
    patch['anatomyNameEn'] = ident
    patch_mesh.materials.append(MATERIALS[palette(ident) if ident else 'skin'])
    for face in patch_mesh.polygons: face.use_smooth = True
    patch_mesh.normals_split_custom_set_from_vertices([body.data.vertices[index].normal for index in used])
    surface_objects.append(patch)
bpy.data.objects.remove(body, do_unlink=True)
log('surface patches', len(surface_objects))

# Smooth shading only: no displacement, scaling or smoothing modifier changes
# any original anatomical vertex. The exploded view preserves muscle mass.
for obj in anatomy:
    obj.data = obj.data.copy()
    obj.data.materials.clear()
    obj.data.materials.append(MATERIALS[palette(obj['anatomyId']) if palette(obj['anatomyId']) != 'skin' else 'anatomy'])
    for face in obj.data.polygons:
        face.material_index = 0
        face.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.hide_set(False); obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_extras=True, export_cameras=False, export_lights=False, export_normals=True, export_materials='EXPORT')
    log('exported', path.name, path.stat().st_size)

export(ASSETS / 'MuscleAtlas_Surface.glb', surface_objects)
export(ASSETS / 'MuscleAtlas_Anatomy.glb', anatomy)
for obj in list(bpy.context.scene.objects):
    if obj not in surface_objects and obj not in anatomy: bpy.data.objects.remove(obj, do_unlink=True)
for obj in anatomy: obj.hide_set(True); obj.hide_render = True
for obj in surface_objects: obj.hide_set(False); obj.hide_render = False

# CPU preview: no CUDA allocation or interference with existing inference jobs.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.world.color = (.18, .18, .18)
camera_data = bpy.data.cameras.new('Atlas Preview')
camera = bpy.data.objects.new('Atlas Preview', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -3.3, 1.0)
direction = Vector((0, 0, .85)) - camera.location
camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 1.9
scene.camera = camera
for location, energy, size in [((2, -3, 4), 450, 4), ((-2, -1, 2), 200, 3)]:
    light_data = bpy.data.lights.new('Studio', 'AREA')
    light_data.energy = energy; light_data.shape = 'DISK'; light_data.size = size
    light = bpy.data.objects.new('Studio', light_data)
    scene.collection.objects.link(light); light.location = location
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = str(WORK / 'muscle-atlas-preview.png')
configure_blender_explosion()
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'muscle-atlas.blend'))
bpy.ops.render.render(write_still=True)
manifest = {'source': SOURCE.name, 'surface': 'MuscleAtlas_Surface.glb', 'anatomy': 'MuscleAtlas_Anatomy.glb', 'surfaceObjects': len(surface_objects), 'anatomyObjects': len(anatomy), 'blender': bpy.app.version_string, 'surfaceIds': sorted({obj['anatomyId'] for obj in surface_objects if obj['anatomyId']})}
(ASSETS / 'muscle-atlas-build.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
log('DONE', json.dumps(manifest))
