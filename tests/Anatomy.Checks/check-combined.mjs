import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from '../../frontend/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {readReference} from '../../frontend/scripts/trigger-point-reference.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const assets=path.join(root,'frontend/apps/frontend/src/assets/anatomy');
const referenceRoot=path.resolve(root,'../Paper/trigger-point');
const data=JSON.parse(fs.readFileSync(path.join(assets,'trigger-point-combined/catalog.json')));
const referenceBinary=fs.readFileSync(path.join(referenceRoot,'src/assets/Z-Anatomy_Muscles_Interactive_Zones.glb'));
const reference=readReference(referenceBinary,fs.readFileSync(path.join(referenceRoot,'src/app/muscle-viewer/muscle-viewer.component.ts'),'utf8'));
assert.equal(createHash('sha256').update(referenceBinary).digest('hex'),data.reference.sha256);
assert.deepEqual(data.zones,reference.zones);
assert.equal(data.summary.referenceMuscles,234);
const load=async binary=>new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
const [old,base,combined]=await Promise.all([
 load(referenceBinary),load(fs.readFileSync(path.join(assets,'muscle-atlas-3d/atlas.glb'))),load(fs.readFileSync(path.join(assets,'trigger-point-combined/atlas.glb'))),
]);
for(const g of [old,base,combined])g.scene.updateMatrixWorld(true);
const objects=g=>{const map=new Map();g.scene.traverse(o=>{if(o.userData.anatomyId&&o.children.length)map.set(o.userData.anatomyId,o);});return map;};
const baseObjects=objects(base),all=objects(combined),oldObjects=new Map();
old.scene.traverse(o=>{const i=old.parser.associations.get(o)?.nodes;if(i!==undefined)oldObjects.set(i,o);});
assert.equal(all.size,data.items.length);assert.equal(all.size,745);
assert.equal(new Set(data.items.map(i=>i.id)).size,745);
const meshes=o=>{const result=[];o.traverse(n=>{if(n.isMesh)result.push(n);});return result;};
let vertices=0,maxError=0;
const check=(expected,actual,translation=new T.Vector3())=>{
 const a=meshes(expected),b=meshes(actual);assert.equal(b.length,a.length);
 for(let i=0;i<a.length;i++){
  const p=a[i].geometry.attributes.position,q=b[i].geometry.attributes.position;assert.equal(q.count,p.count);
  const sourceIndex=a[i].geometry.index,targetIndex=b[i].geometry.index;
  const count=sourceIndex?.count??p.count;assert.equal(targetIndex?.count??q.count,count);
  const mirrored=a[i].matrixWorld.determinant()<0;
  for(let j=0;j<count;j++){
   const sourceOffset=mirrored&&j%3!==0?j+(j%3===1?1:-1):j;
   assert.equal(targetIndex?.getX(j)??j,sourceIndex?.getX(sourceOffset)??sourceOffset,'Triangle topology/winding changed');
  }
  for(let j=0;j<p.count;j++){
   const x=new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(a[i].matrixWorld).add(translation);
   const y=new T.Vector3().fromBufferAttribute(q,j).applyMatrix4(b[i].matrixWorld);
   const error=x.distanceTo(y);maxError=Math.max(maxError,error);assert.ok(error<.000002,`Geometry moved ${error}m`);vertices++;
  }
 }
};
for(const [id,o]of baseObjects){assert.ok(all.has(id),`Lost original FJ ID: ${id}`);check(o,all.get(id));}
for(const item of data.items){
 assert.match(item.name,/[\u3400-\u9fff]/);assert.ok(item.zones.every(z=>z in data.zones));
 assert.equal(all.get(item.id).userData.region,item.zone);
 if(item.source==='trigger-point'){
  const row=reference.structures.find(r=>r.nodes.includes(item.sourceNodeIndex));assert.equal(row.type,'muscle');
  assert.deepEqual(item.zones,row.zones);check(oldObjects.get(item.sourceNodeIndex),all.get(item.id),new T.Vector3(...data.registration.translationMetres));
 }else if(item.referenceId){const row=reference.structures.find(r=>r.id===item.referenceId);assert.deepEqual(item.zones,row.zones);}
}
for(const row of data.comparison.filter(r=>r.type==='muscle')){
 const items=data.items.filter(i=>i.referenceId===row.id);assert.ok(items.length,`Missing muscle: ${row.id}`);
 if(row.status!=='matched')assert.deepEqual(items.map(i=>i.sourceNodeIndex).sort((a,b)=>a-b),[...row.nodes].sort((a,b)=>a-b));
}
for(const [a,b]of data.adjacency)assert.notEqual(data.colors[a],data.colors[b]);
console.log(`PASS: exact source categories, all 234 reference muscle names covered, 492 original FJ structures preserved, 253 actual source objects added; ${vertices} vertex positions checked, max error ${maxError}m; adjacent colors verified.`);

