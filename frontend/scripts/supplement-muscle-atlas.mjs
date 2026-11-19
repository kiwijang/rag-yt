// Supplement the immutable muscle-atlas-3d GLB with missing trigger-point muscles.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {canonical,aggregateParts,isSupport,readReference,compareReference} from './trigger-point-reference.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const referenceRoot=path.resolve(process.argv[2]??path.join(root,'../Paper/trigger-point'));
const assets=path.join(root,'frontend/apps/frontend/src/assets/anatomy');
const output=path.join(assets,'trigger-point-combined');await mkdir(output,{recursive:true});
const referenceBinary=await readFile(path.join(referenceRoot,'src/assets/Z-Anatomy_Muscles_Interactive_Zones.glb'));
const component=await readFile(path.join(referenceRoot,'src/app/muscle-viewer/muscle-viewer.component.ts'),'utf8');
const reference=readReference(referenceBinary,component);
const baseline=JSON.parse(await readFile(path.join(assets,'muscle-atlas-3d/catalog.json'),'utf8'));
const comparison=compareReference(reference,baseline.items.filter(item=>item.type!=='bone'));
const load=async binary=>new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
const [old,current]=await Promise.all([load(referenceBinary),load(await readFile(path.join(assets,'muscle-atlas-3d/atlas.glb')))]);
old.scene.updateMatrixWorld(true);current.scene.updateMatrixWorld(true);
const referenceObjects=new Map();old.scene.traverse(object=>{
  const index=old.parser.associations.get(object)?.nodes;
  if(index!==undefined)referenceObjects.set(index,object);
});
const currentObjects=new Map();current.scene.traverse(object=>{if(object.userData.anatomyId&&object.children.length)currentObjects.set(object.userData.anatomyId,object);});
const center=object=>new T.Box3().setFromObject(object).getCenter(new T.Vector3());
const sideFromName=name=>/\.l(?:\.\d+)?$/.test(name)?'left':/\.r(?:\.\d+)?$/.test(name)?'right':'midline';
const oldSide=(row,index)=>sideFromName(row.originalNames[row.nodes.indexOf(index)]);

// Median translation from explicitly matched bilateral muscles. No model-wide
// scaling, reflection, per-muscle rescaling, or spatial deformation is applied.
const anchors=[];
for(const row of comparison.filter(row=>row.type==='muscle'&&row.status==='matched'))for(const index of row.nodes){
  const candidates=row.matchedIds.map(id=>baseline.items.find(item=>item.id===id)).filter(item=>item.side===oldSide(row,index));
  if(candidates.length!==1)continue;
  const a=center(referenceObjects.get(index)),b=center(currentObjects.get(candidates[0].id));
  anchors.push({reference:row.originalNames[row.nodes.indexOf(index)],current:candidates[0].id,delta:b.clone().sub(a).toArray()});
}
const median=values=>{values.sort((a,b)=>a-b);return(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2;};
const shift=new T.Vector3(...[0,1,2].map(i=>median(anchors.map(a=>a.delta[i]))));
for(const a of anchors)a.residualMetres=new T.Vector3(...a.delta).sub(shift).length();
const medianResidual=median(anchors.map(a=>a.residualMetres));
if(anchors.length<20||medianResidual>.04)throw Error(`Unreliable reference registration: ${anchors.length} anchors, ${medianResidual}m residual`);
const labelsText=await readFile(path.join(root,'frontend/apps/frontend/src/app/pages/muscles-page/anatomy-labels.zh-Hant.ts'),'utf8');
const labels=Object.fromEntries([...labelsText.matchAll(/^  '([^']+)': '([^']+)',/gm)].map(m=>[m[1],m[2]]));
const items=baseline.items.map(item=>{
  const row=comparison.find(row=>row.matchedIds.includes(item.id));
  const parts=aggregateParts[canonical(item.english)]??[];
  const partRows=comparison.filter(row=>parts.includes(row.id));
  const zones=row?.zones??[...new Set(partRows.flatMap(row=>row.zones))];
  return {...item,type:item.type==='bone'?'bone':isSupport(item.english)?'support':'muscle',
    source:'muscle-atlas-3d',zone:zones[0]??'Zone_Unassigned',zones:zones.length?zones:['Zone_Unassigned'],
    referenceId:row?.id??null,aggregate:parts.length>0,originalRegion:item.zone};
});
const scene=new T.Scene();
for(const item of items){const object=currentObjects.get(item.id);object.removeFromParent();scene.add(object);}
for(const row of comparison.filter(row=>row.type==='muscle'&&row.status!=='matched')){
  for(const index of row.nodes){
    const source=referenceObjects.get(index),group=new T.Group();
    const side=oldSide(row,index),id=`TP:${index}`;
    const item={id,name:({left:'左',right:'右',midline:''}[side])+(labels[row.id]??row.id),english:row.english,
      type:'muscle',zone:row.zones[0],zones:row.zones,location:{left:'左側',right:'右側',midline:'中線／未標側別'}[side],
      side,file:'Z-Anatomy_Muscles_Interactive_Zones.glb',source:'trigger-point',sourceNodeIndex:index,
      sourceNodeName:row.originalNames[row.nodes.indexOf(index)],referenceId:row.id,aggregate:false};
    if(!labels[row.id])throw Error(`Missing Traditional Chinese label: ${row.id}`);
    source.traverse(object=>{
      if(!object.isMesh)return;
      const geometry=object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);geometry.translate(...shift.toArray());
      // Baking a mirrored source matrix removes Three.js's runtime winding
      // correction. Reverse only triangle indices to keep exterior normals.
      if(object.matrixWorld.determinant()<0){
        if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
        const triangles=geometry.index;
        for(let i=0;i<triangles.count;i+=3){const b=triangles.getX(i+1);triangles.setX(i+1,triangles.getX(i+2));triangles.setX(i+2,b);}
      }
      const mesh=new T.Mesh(geometry);group.add(mesh);
    });
    if(!group.children.length)throw Error(`No geometry: ${row.id}`);
    group.name=id;scene.add(group);currentObjects.set(id,group);items.push(item);
  }
}
for(const item of items){
  const group=currentObjects.get(item.id);
  const extras={anatomyId:item.id,atlasRole:item.type,nameZh:item.name,nameEn:item.english,region:item.zone,zones:item.zones,source:item.source,aggregate:item.aggregate,referenceId:item.referenceId};
  group.userData=extras;
  group.traverse(object=>{if(object.isMesh)object.userData=extras;});
}
scene.updateMatrixWorld(true);
// Recolor all distinct neighbouring families using the same deterministic DSATUR
// policy as the base importer, now including the added facial/hand/deep muscles.
const families=new Map(),entries=[];
for(const item of items){
  const group=currentObjects.get(item.id),family=canonical(item.referenceId??item.english);
  const box=new T.Box3().setFromObject(group);entries.push({item,group,family,box});
  if(item.type==='muscle'&&!item.aggregate)families.set(family,new Set());
}
const muscles=entries.filter(e=>e.item.type==='muscle'&&!e.item.aggregate);
for(let i=0;i<muscles.length;i++)for(let j=i+1;j<muscles.length;j++){
  const a=muscles[i],b=muscles[j];if(a.family===b.family)continue;
  if(Math.hypot(...['x','y','z'].map(axis=>Math.max(a.box.min[axis]-b.box.max[axis],b.box.min[axis]-a.box.max[axis],0)))<=.012){families.get(a.family).add(b.family);families.get(b.family).add(a.family);}
}
const colors=new Map();
while(colors.size<families.size){
  const saturation=key=>new Set([...families.get(key)].filter(k=>colors.has(k)).map(k=>colors.get(k))).size;
  const key=[...families.keys()].filter(k=>!colors.has(k)).sort((a,b)=>saturation(b)-saturation(a)||families.get(b).size-families.get(a).size||a.localeCompare(b,'en'))[0];
  const used=new Set([...families.get(key)].map(k=>colors.get(k)));let index=0;while(used.has(index))index++;colors.set(key,index);
}
const palette=['#c96b73','#568ebc','#68a38c','#c7a258','#9577b3','#c77e9e','#5ca5ac','#b68c6a','#7f9e53','#777ab7','#ba7659','#6d9cba'];
for(const {item,group,family}of entries){
  const index=colors.get(family)??0,color=item.type==='bone'?new T.Color('#dfd3bb'):item.type==='support'?new T.Color('#adb9c7'):index<palette.length?new T.Color(palette[index]):new T.Color().setHSL((index*.61803398875)%1,.58,.54);
  const material=new T.MeshStandardMaterial({color,roughness:.67,metalness:.02,side:T.DoubleSide});
  group.traverse(object=>{if(object.isMesh)object.material=material;});group.userData.paletteIndex=index;
}
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();});}};
const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false});
await writeFile(path.join(output,'atlas.glb'),Buffer.from(binary));
const summary={referenceStructures:reference.structures.length,referenceMuscles:comparison.filter(r=>r.type==='muscle').length,referenceSupport:comparison.filter(r=>r.type==='support').length,matchedMuscleNames:comparison.filter(r=>r.type==='muscle'&&r.status==='matched').length,missingMuscleNames:comparison.filter(r=>r.status==='missing-added').length,subdivisionNames:comparison.filter(r=>r.status==='subdivision-added').length,addedObjects:items.filter(i=>i.source==='trigger-point').length,totalObjects:items.length,muscles:items.filter(i=>i.type==='muscle').length,bones:items.filter(i=>i.type==='bone').length,support:items.filter(i=>i.type==='support').length,aggregates:items.filter(i=>i.aggregate).length};
const manifest={reference:{path:'Paper/trigger-point',asset:baseline.file??'Z-Anatomy_Muscles_Interactive_Zones.glb',sha256:reference.sha256,componentSha256:createHash('sha256').update(component).digest('hex'),helperNodesExcluded:reference.helpers},baseline:{revision:baseline.revision,objects:baseline.items.length},zones:reference.zones,summary,registration:{method:'median translation of explicitly matched bilateral muscle bounds centres',translationMetres:shift.toArray(),medianResidualMetres:medianResidual,anchors},items,comparison,colors:Object.fromEntries(colors),adjacency:[...families].flatMap(([a,ns])=>[...ns].filter(b=>a<b).map(b=>[a,b])),bytes:binary.byteLength};
await writeFile(path.join(output,'catalog.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(root,'frontend/apps/frontend/src/app/pages/muscles-page/combined-catalog.generated.ts'),`// Generated by npm run anatomy:supplement. See assets/anatomy/trigger-point-combined/ATTRIBUTION.md.\nexport const COMBINED_ZONES = ${JSON.stringify(reference.zones)};\nexport const COMBINED_SUMMARY = ${JSON.stringify(summary)};\nexport const COMBINED_STRUCTURES = ${JSON.stringify(items,null,2)};\n`);
const statuses={matched:'已有對應', 'missing-added':'缺少：已補模型','subdivision-added':'只有整組：已補獨立分部','support-not-added':'非肌肉：未補入'};
const rows=comparison.map(row=>`| ${labels[row.id]??row.id} | ${row.id} | ${row.zones.map(z=>reference.zones[z]).join('、')} | ${statuses[row.status]} | ${row.matchedIds.join(', ')||row.aggregateIds.join(', ')||'—'} |`);
await writeFile(path.join(root,'docs/anatomy-comparison.md'),`# trigger-point 與目前肌肉模型差異\n\n分類直接讀取 trigger-point 的 zoneControls，肌肉歸屬直接讀取其 GLB Zone_* 階層，未分類保持未分類。原專案 GLB SHA-256：\`${reference.sha256}\`。\n\n## 數量與處理\n\n- 參考模型：${summary.referenceStructures} 種結構名稱（${summary.referenceMuscles} 肌肉／肌肉分部，${summary.referenceSupport} 非肌肉結構），左右側合計 ${reference.structures.reduce((n,r)=>n+r.nodes.length,0)} 個物件；排除 ${reference.helpers} 個文字／群組輔助 Mesh。\n- 現有來源：492 個物件，包含原標示為肌肉的韌帶／膜／髂脛束；這些改標為支持結構，不算肌肉。\n- 已有明確同義名稱對應：${summary.matchedMuscleNames} 種；缺少 ${summary.missingMuscleNames} 種，只有整組而缺獨立分部 ${summary.subdivisionNames} 種。\n- 從參考 GLB 補入 ${summary.addedObjects} 個左右側／中線模型物件，並非僅新增名稱。現在 ${summary.muscles} 肌肉物件、${summary.bones} 骨骼、${summary.support} 支持結構，共 ${summary.totalObjects} 個。\n- 保留全部 492 個原模型物件與 FJ ID。${summary.aggregates} 個整組肌肉在已有細分模型時預設隱藏，可勾選顯示或直接選取；避免與細分部重疊。\n- 參考來源的筋膜、滑囊、肌腱等非肌肉結構另列，未當作缺肌肉批次加入。\n\n## 配準與限制\n\n兩份來源的姿勢與幾何並不完全相同。以 ${anchors.length} 個明確同名、同側肌肉的包圍盒中心計算單一中位平移：${shift.toArray().map(v=>v.toFixed(6)).join(', ')} 公尺，中位殘差 ${(medianResidual*1000).toFixed(1)} mm。新增網格僅套用原始世界矩陣與此平移，未雕塑、縮放或變更肌肉量；這是視覺配準，不是已驗證的醫學影像配準。每個錨點殘差、原始節點與完整對應可查資產 catalog.json。\n\n參考來源中有些分類與直觀位置不同（例如拇指短屈肌分部在頭頸、部分足肌在前臂手部）；本次依使用者要求保留，不根據位置自動重分。未提供分類的新增骨骼及原來源額外肌肉顯示未分類。兩份來源都沒有可用皮膚或激痛點資料。\n\n## 逐項對照\n\n分類與覆蓋以名稱／分部為單位；物件數量則含左右側，兩者不可直接相減。整組覆蓋不視為獨立分部已存在。\n\n| 中文名稱 | 參考名稱 | 參考分類 | 結果 | 原模型 FJ ID（或整組 ID） |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## 原來源獨有或尚無精確對應的項目\n\n${items.filter(i=>i.source==='muscle-atlas-3d'&&i.type!=='bone'&&!i.referenceId).map(i=>`- ${i.id} · ${i.name} · ${i.english}${i.aggregate?'（整組，預設隱藏）':''}`).join('\n')}\n`);
console.log(JSON.stringify({summary,translation:shift.toArray(),anchors:anchors.length,medianResidualMetres:medianResidual,bytes:binary.byteLength},null,2));
