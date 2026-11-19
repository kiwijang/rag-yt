"""Export actual Startup.blend muscle meshes into a separate derived GLB.

Run in Blender background with --disable-autoexec. Never saves the source file.
"""
import bpy, hashlib, json, re, sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
source = Path(sys.argv[sys.argv.index('--')+1])
output = ROOT / 'models/startup-audit'
output.mkdir(parents=True,exist_ok=True)
original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)

def support(name):
    return not re.search(r'\btensor fasciae latae\b',name,re.I) and re.search(r'fascia|bursa|bursae|tendon|tendinous|ligament|septum|retinaculum|aponeurosis|tract|arch|tarsus|trochlea|linea alba|membrane|sheath',name,re.I)

head_bones=set(json.loads((ROOT/'scripts/anatomy/startup-head-bones.json').read_text(encoding='utf8')).values())
sources=sorted([obj for obj in bpy.data.objects if obj.type=='MESH' and
                (obj.name in head_bones or (any(c.name=='Muscles' for c in obj.users_collection) and
                (not support(obj.name) or re.match(r'^Epicranial aponeurosis\.[lr]$',obj.name))))],key=lambda obj:obj.name)
assert len(sources)>400, 'Unexpected/missing Muscles collection'
depsgraph=bpy.context.evaluated_depsgraph_get()
neutral=bpy.data.materials.new('Startup muscle export');neutral.diffuse_color=(.55,.25,.25,1)
scene=bpy.data.scenes.new('Derived muscle export')
rows=[]
for source_obj in sources:
    evaluated=source_obj.evaluated_get(depsgraph)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=False,depsgraph=depsgraph)
    mesh.transform(source_obj.matrix_world)
    if source_obj.matrix_world.determinant()<0: mesh.flip_normals()
    mesh.materials.clear();mesh.materials.append(neutral)
    for face in mesh.polygons: face.material_index=0;face.use_smooth=True
    obj=bpy.data.objects.new(source_obj.name+'__export',mesh);scene.collection.objects.link(obj)
    obj['sourceObjectName']=source_obj.name
    obj['sourceFamily']=re.sub(r'\.[lr](?:\.\d+)?$','',source_obj.name).strip()
    obj['sourceCollections']=[c.name for c in source_obj.users_collection]
    side='left' if re.search(r'\.l(?:\.\d+)?$',source_obj.name) else 'right' if re.search(r'\.r(?:\.\d+)?$',source_obj.name) else 'midline'
    # The source's left iliocostalis colli has no .l suffix, but has an explicit
    # .r counterpart and is wholly on the positive-X (left) side.
    inferred=False
    if side=='midline' and (obj['sourceFamily']+'.r') in bpy.data.objects and min(v.co.x for v in mesh.vertices)>0:
        side='left';inferred=True
    obj['sourceSide']=side
    for vertex in mesh.vertices:
        assert all(abs(c)<10 for c in vertex.co), source_obj.name
    points=[v.co for v in mesh.vertices]
    row=dict(name=source_obj.name,family=obj['sourceFamily'],type='bone' if source_obj.name in head_bones else 'support' if support(source_obj.name) else 'muscle',side=side,sideInferred=inferred,
             collections=list(obj['sourceCollections']),vertices=len(points),polygons=len(mesh.polygons),
             modifiers=[dict(name=m.name,type=m.type) for m in source_obj.modifiers],
             bounds=dict(min=[min(v[i] for v in points) for i in range(3)],max=[max(v[i] for v in points) for i in range(3)]))
    rows.append(row)
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.context.window.scene=scene
bpy.ops.export_scene.gltf(filepath=str(output/'muscles.glb'),export_format='GLB',use_active_scene=True,
                         export_extras=True,export_yup=True,export_animations=False,export_cameras=False,
                         export_lights=False,export_materials='EXPORT',export_apply=False)
result=dict(sourceFile=source.name,sha256=original_hash,blender=bpy.app.version_string,
            coordinateConversion='Blender (x,y,z) metres -> glTF (x,z,-y) metres',
            exportedObjects=len(rows),muscleObjects=sum(r['type']=='muscle' for r in rows),
            supportObjects=sum(r['type']=='support' for r in rows),
            boneObjects=sum(r['type']=='bone' for r in rows),
            muscleNames=len(set(r['family'] for r in rows if r['type']=='muscle')),objects=rows)
(output/'source-muscles.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
assert hashlib.sha256(source.read_bytes()).hexdigest()==original_hash
print('STARTUP_EXPORT',result['muscleObjects'],'muscles +',result['supportObjects'],'support structures; source preserved',original_hash,flush=True)


