import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import * as T from '../../frontend/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const assets=path.join(root,'frontend/apps/frontend/src/assets/anatomy');
const manifest=JSON.parse(fs.readFileSync(path.join(assets,'startup-reconciled/catalog.json')));
const previous=JSON.parse(fs.readFileSync(path.join(assets,'trigger-point-combined/catalog.json')));
const source=JSON.parse(fs.readFileSync(path.join(root,'models/startup-audit/source-muscles.json')));
assert.equal(manifest.items.length,712);assert.equal(manifest.summary.muscles,466);
assert.equal(manifest.summary.removed,31);assert.equal(manifest.summary.added,1);
const ids=new Set(manifest.items.map(i=>i.id));assert.equal(ids.size,712);
const excludedIds=new Set(manifest.excluded.map(i=>i.id));
assert.equal(excludedIds.size,5);
for(const old of previous.items)assert.ok(ids.has(old.id)||ids.has(manifest.aliases[old.id])||excludedIds.has(old.id),`Lost ID without redirect ${old.id}`);
for(const [old,target]of Object.entries(manifest.aliases)){assert.ok(!ids.has(old));assert.ok(ids.has(target));}
const allSource=manifest.items.filter(i=>i.source==='Z-Anatomy Startup');
const sourceItems=allSource.filter(i=>i.type==='muscle');
assert.equal(allSource.length,486);
assert.equal(allSource.filter(i=>i.type==='bone').length,22);
assert.equal(manifest.summary.headBonesReplaced,22);
for(const [id,name]of Object.entries(JSON.parse(fs.readFileSync(path.join(root,'scripts/anatomy/startup-head-bones.json'))))){
 const bone=manifest.items.find(i=>i.id===id);assert.equal(bone.type,'bone');assert.equal(bone.sourceObjectName,name);assert.equal(bone.source,'Z-Anatomy Startup');
}
assert.equal(sourceItems.length,462);assert.equal(new Set(sourceItems.map(i=>i.sourceObjectName)).size,462);
assert.equal(new Set(sourceItems.map(i=>i.referenceId+'|'+i.side)).size,462);
assert.equal(new Set(sourceItems.map(i=>i.referenceId)).size,232);
for(const row of source.objects)assert.equal(allSource.filter(i=>i.sourceObjectName===row.name).length,1);
assert.equal(manifest.items.filter(i=>i.referenceId==='Internal abdominal oblique muscle'&&i.side==='right').length,1);
assert.equal(manifest.items.filter(i=>i.referenceId==='Vastus intermedius muscle').length,2);
assert.equal(manifest.items.filter(i=>i.type==='muscle'&&/sheath/i.test(i.english)).length,0);
const galea=manifest.items.filter(i=>i.referenceId==='Epicranial aponeurosis');
assert.equal(galea.length,2);assert.deepEqual(galea.map(i=>i.side).sort(),['left','right']);
assert.ok(galea.every(i=>i.type==='support'&&i.zone==='Zone_Head_Neck'));
assert.equal(manifest.items.filter(i=>i.aggregate).length,0);
for(const item of manifest.items){assert.match(item.name,/[\u3400-\u9fff]/);assert.ok(item.zones.every(z=>z in manifest.zones));}
const load=async p=>{const b=fs.readFileSync(p);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const [raw,old,active]=await Promise.all([load(path.join(root,'models/startup-audit/muscles.glb')),load(path.join(assets,'trigger-point-combined/atlas.glb')),load(path.join(assets,'startup-reconciled/atlas.glb'))]);
for(const g of [raw,old,active])g.scene.updateMatrixWorld(true);
const groupMap=g=>{const map=new Map();g.scene.traverse(o=>{if(o.userData.anatomyId&&o.children.length)map.set(o.userData.anatomyId,o);});return map;};
const oldGroups=groupMap(old),groups=groupMap(active),sources=new Map();raw.scene.traverse(o=>{if(o.userData.sourceObjectName)sources.set(o.userData.sourceObjectName,o);});
assert.equal(groups.size,712);
const meshes=o=>{const result=[];o.traverse(n=>{if(n.isMesh)result.push(n);});return result;};
let checked=0,maxError=0;
for(const item of manifest.items){
 const isSource=item.source==='Z-Anatomy Startup';
 const a=meshes(isSource?sources.get(item.sourceObjectName):oldGroups.get(item.id)),b=meshes(groups.get(item.id));
 assert.equal(b.length,a.length);const shift=isSource?new T.Vector3(...manifest.registration.translationMetres):new T.Vector3();
 for(let i=0;i<a.length;i++){
  const p=a[i].geometry.attributes.position,q=b[i].geometry.attributes.position;assert.equal(q.count,p.count);
  for(let j=0;j<p.count;j++){
   const x=new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(a[i].matrixWorld).add(shift),y=new T.Vector3().fromBufferAttribute(q,j).applyMatrix4(b[i].matrixWorld);
   const error=x.distanceTo(y);assert.ok(Number.isFinite(error)&&error<.000002,`${item.id} changed geometry`);checked++;maxError=Math.max(maxError,error);
  }
 }
}
for(const [a,b]of manifest.adjacency)assert.notEqual(manifest.colors[a],manifest.colors[b]);
console.log(`PASS: Startup 462 muscles / 232 names exactly once, 31 removed IDs redirected, missing right internal oblique restored, 712 active objects; ${checked} vertices verified, max error ${maxError}m.`);



