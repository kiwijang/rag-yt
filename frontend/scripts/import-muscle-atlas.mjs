// Import user-selected model data. No upstream application code is copied/executed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const project = fileURLToPath(new URL('../../', import.meta.url));
const upstream = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass the checked-out upstream repository directory.');
const revision = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const output = path.join(project, 'frontend/apps/frontend/src/assets/anatomy/muscle-atlas-3d');
await mkdir(output, {recursive:true});
execFileSync(path.join(project,'.venv/Scripts/python.exe'), [path.join(project,'scripts/anatomy/import-upstream-catalog.py'),upstream,output,revision], {stdio:'inherit'});
const metadata = JSON.parse(await readFile(path.join(output,'catalog.json'),'utf8'));
const generated = path.join(project,'frontend/apps/frontend/src/app/pages/muscles-page/upstream-catalog.generated.ts');
await writeFile(generated, `// Generated from pinned muscle-atlas-3d / BodyParts3D data, CC BY-SA 2.1 Japan.\n// See assets/anatomy/muscle-atlas-3d/ATTRIBUTION.md.\nexport const UPSTREAM_REVISION = ${JSON.stringify(revision)};\nexport const UPSTREAM_STRUCTURES = ${JSON.stringify(metadata.items,null,2)};\n`);

const scene = new THREE.Scene(), loader = new OBJLoader(), entries = [];
for (const item of metadata.items) {
  const group = loader.parse(await readFile(path.join(upstream,'models',item.file),'utf8'));
  group.name = item.id;
  group.userData = {anatomyId:item.id,atlasRole:item.type,nameZh:item.name,nameEn:item.english,region:item.zone,sourceFile:item.file};
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    // Source OBJ coordinates: millimetres, Z-up, front=-Y. Export metres, Y-up,
    // front=+Z. No remeshing, deformation, skin reconstruction or muscle scaling.
    object.geometry.deleteAttribute('normal');
    object.geometry = mergeVertices(object.geometry, .0001);
    object.geometry.scale(.001,.001,.001); object.geometry.rotateX(-Math.PI/2);
    object.geometry.computeVertexNormals();
    object.userData = {...group.userData};
  });
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const family = item.english.replace(/^(?:Left|Right|L|R)\s+/i,'').toLowerCase();
  entries.push({item,group,box,family}); scene.add(group);
}

// Conservatively treat touching/nearby muscle bounds as neighbours. DSATUR
// assigns different palette indices to neighbouring distinct muscle families;
// homologous left/right structures keep the same colour. Deterministic, no random hues.
const graph = new Map();
for (const e of entries.filter(e=>e.item.type==='muscle')) graph.set(e.family,new Set());
const muscles = entries.filter(e=>e.item.type==='muscle');
for (let i=0;i<muscles.length;i++) for (let j=i+1;j<muscles.length;j++) {
  const a=muscles[i],b=muscles[j]; if(a.family===b.family) continue;
  const gap=['x','y','z'].map(axis=>Math.max(a.box.min[axis]-b.box.max[axis],b.box.min[axis]-a.box.max[axis],0));
  if(Math.hypot(...gap)<=.012) {graph.get(a.family).add(b.family);graph.get(b.family).add(a.family);}
}
const assigned=new Map();
while(assigned.size<graph.size) {
  const pending=[...graph.keys()].filter(k=>!assigned.has(k));
  const saturation=k=>new Set([...graph.get(k)].filter(n=>assigned.has(n)).map(n=>assigned.get(n))).size;
  pending.sort((a,b)=>saturation(b)-saturation(a)||graph.get(b).size-graph.get(a).size||a.localeCompare(b,'en'));
  const key=pending[0], used=new Set([...graph.get(key)].map(k=>assigned.get(k)));
  let index=0;while(used.has(index))index++;assigned.set(key,index);
}
const palette=['#c96b73','#568ebc','#68a38c','#c7a258','#9577b3','#c77e9e','#5ca5ac','#b68c6a','#7f9e53','#777ab7','#ba7659','#6d9cba'];
for(const entry of entries) {
  const index=assigned.get(entry.family)??0;
  const color=entry.item.type==='bone'?new THREE.Color('#dfd3bb'):index<palette.length?new THREE.Color(palette[index]):new THREE.Color().setHSL((index*.61803398875)%1,.58,.54);
  const material=new THREE.MeshStandardMaterial({color,roughness:.67,metalness:.02,side:THREE.DoubleSide});
  entry.group.traverse(object=>{if(object instanceof THREE.Mesh)object.material=material;});
  entry.group.userData['paletteIndex']=entry.item.type==='muscle'?index:-1;
}

// GLTFExporter uses FileReader for binary buffers; no textures/browser DOM needed.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();});}
};
const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false});
await writeFile(path.join(output,'atlas.glb'),Buffer.from(binary));
metadata.export={file:'atlas.glb',bytes:binary.byteLength,units:'metres',up:'Y',front:'+Z',paletteFamilies:assigned.size,paletteColors:Math.max(...assigned.values())+1,adjacency:[...graph].flatMap(([a,ns])=>[...ns].filter(b=>a<b).map(b=>[a,b])),colors:Object.fromEntries(assigned)};
await writeFile(path.join(output,'catalog.json'),JSON.stringify(metadata,null,2));
console.log(`Imported ${metadata.items.length} structures from ${revision}; GLB ${(binary.byteLength/1e6).toFixed(1)} MB; ${metadata.export.paletteColors} muscle colours.`);
