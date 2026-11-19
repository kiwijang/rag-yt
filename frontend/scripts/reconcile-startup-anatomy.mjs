// Source-authoritative muscle reconciliation; all original input assets survive.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {canonical,aggregateParts} from './trigger-point-reference.mjs';
import {ANATOMICAL_REGIONS,reviewedClassification,scopeDecision} from './anatomy-classification.mjs';
import {writeClassificationAudit} from './write-anatomy-classification-audit.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const work=path.join(root,'models/startup-audit');
const source=path.resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--'))??path.join(root,'../Z-Anatomy/Startup.blend'));
if(!process.argv.includes('--reuse-export'))execFileSync(process.env.BLENDER_PATH??'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',
 ['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',path.join(root,'scripts/anatomy/export-startup-muscles.py'),'--',source],{stdio:['ignore','ignore','inherit']});
const sourceInfo=JSON.parse(await readFile(path.join(work,'source-muscles.json'),'utf8'));
const headBones=JSON.parse(await readFile(path.join(root,'scripts/anatomy/startup-head-bones.json'),'utf8'));
const boneIds=new Map(Object.entries(headBones).map(([id,name])=>[name,id]));
if(createHash('sha256').update(await readFile(source)).digest('hex')!==sourceInfo.sha256)throw Error('Source blend/export hash mismatch');
const assets=path.join(root,'frontend/apps/frontend/src/assets/anatomy');
const output=path.join(assets,'startup-reconciled');await mkdir(output,{recursive:true});
const previous=JSON.parse(await readFile(path.join(assets,'trigger-point-combined/catalog.json'),'utf8'));
const load=async binary=>new GLTFLoader().parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
const [raw,old]=await Promise.all([load(await readFile(path.join(work,'muscles.glb'))),load(await readFile(path.join(assets,'trigger-point-combined/atlas.glb')))]);
raw.scene.updateMatrixWorld(true);old.scene.updateMatrixWorld(true);
const oldObjects=new Map(),sourceObjects=new Map();
old.scene.traverse(o=>{if(o.userData.anatomyId&&o.children.length)oldObjects.set(o.userData.anatomyId,o);});
raw.scene.traverse(o=>{if(o.userData.sourceObjectName)sourceObjects.set(o.userData.sourceObjectName,o);});
if(sourceObjects.size!==sourceInfo.exportedObjects||sourceInfo.supportObjects!==2||sourceInfo.boneObjects!==boneIds.size)throw Error('Incomplete Startup export: re-export muscles, aponeurosis and matching skull');
const labels=Object.fromEntries([...((await readFile(path.join(root,'frontend/apps/frontend/src/app/pages/muscles-page/anatomy-labels.zh-Hant.ts'),'utf8')).matchAll(/^  '([^']+)': '([^']+)',/gm))].map(m=>[m[1],m[2]]));
const shift=new T.Vector3(...previous.registration.translationMetres);
const center=o=>new T.Box3().setFromObject(o).getCenter(new T.Vector3());
const scene=new T.Scene(),items=[],used=new Set(),changes=[],aliases={},redirects={};
const excluded=[];
const add=(item,object)=>{items.push(item);object.name=item.id;scene.add(object);used.add(item.id);};
for(const src of sourceInfo.objects){
 const from=sourceObjects.get(src.name),destination=center(from).add(shift);
 const candidates=src.type==='bone'?previous.items.filter(i=>i.id===boneIds.get(src.name)):previous.items.filter(i=>i.type===src.type&&i.referenceId===src.family&&!used.has(i.id)&&
  (i.side==='midline'||src.side==='midline'||i.side===src.side));
 candidates.sort((a,b)=>center(oldObjects.get(a.id)).distanceToSquared(destination)-center(oldObjects.get(b.id)).distanceToSquared(destination)||a.id.localeCompare(b.id));
 const prior=candidates[0];
 const id=prior?.id??`ZA:${canonical(src.family).replace(/[^a-z0-9]+/g,'-')}:${src.side}`;
 const familyRow=src.type==='bone'?{zones:prior?.zones}:previous.comparison.find(r=>r.id===src.family);
 if(!familyRow||!familyRow.zones||(src.type!=='bone'&&!labels[src.family]))throw Error(`Missing classification/Chinese label: ${src.family}`);
 const item={id,name:src.type==='bone'?prior.name.replace(/[（(]補[）)]/g,''):({left:'左',right:'右',midline:''}[src.side])+labels[src.family],english:src.type==='bone'?prior.english:src.family,
  type:src.type,zone:familyRow.zones[0],zones:familyRow.zones,location:{left:'左側',right:'右側',midline:'中線'}[src.side],
  side:src.side,file:'Startup.blend',source:'Z-Anatomy Startup',sourceObjectName:src.name,sourceSideInferred:src.sideInferred,
  referenceId:src.type==='bone'?prior.referenceId:src.family,aggregate:false,
  legacySource:prior?{source:prior.source,file:prior.file,sha256:prior.sha256??null,sourceNodeIndex:prior.sourceNodeIndex??null}:null};
 const group=new T.Group();from.traverse(object=>{
  if(!object.isMesh)return;
  const geometry=object.geometry.clone();geometry.applyMatrix4(object.matrixWorld);geometry.translate(...shift.toArray());
  group.add(new T.Mesh(geometry));
 });
 if(!group.children.length)throw Error(`Missing source geometry: ${src.name}`);
 add(item,group);
 if(!prior)changes.push({kind:src.type==='support'?'added-support-structure':'added-missing-side',id,sourceObjectName:src.name,referenceId:src.family,side:src.side});
 else if(src.type==='bone')changes.push({kind:'replaced-misaligned-head-bone',id,sourceObjectName:src.name,english:prior.english});
}
// These broad names are represented by Startup's individual muscle parts.
// Cervical intertransversarii absent from Startup are deliberately NOT removed.
const broadParts={...aggregateParts,
 'pectoralis major':['(Abdominal part of pectoralis major muscle)','Clavicular head of pectoralis major muscle','Sternocostal head of pectoralis major muscle'],
 'erector spinae':sourceInfo.objects.map(o=>o.family).filter(n=>/^(Iliocostalis|Longissimus|Spinalis) /i.test(n)),
 'interspinalis':sourceInfo.objects.map(o=>o.family).filter(n=>/^Interspinales /i.test(n)),
};
for(const prior of previous.items){
 if(used.has(prior.id))continue;
 const scope=scopeDecision(prior);
 if(!scope.keep){excluded.push({id:prior.id,name:prior.name,english:prior.english,reason:scope.reason});continue;}
 let kind,targets=[];
 if(prior.type==='muscle'&&prior.referenceId&&items.some(i=>i.referenceId===prior.referenceId)){
  kind='duplicate-anatomical-identity';targets=items.filter(i=>i.referenceId===prior.referenceId&&(prior.side==='midline'||i.side===prior.side));
 }else if(prior.type==='muscle'&&broadParts[canonical(prior.english)]){
  kind='overlapping-whole-muscle';const families=new Set(broadParts[canonical(prior.english)]);
  targets=items.filter(i=>families.has(i.referenceId)&&(prior.side==='midline'||i.side===prior.side));
 }
 if(targets.length){
  targets.sort((a,b)=>center(oldObjects.get(prior.id)).distanceToSquared(center(sourceObjects.get(a.sourceObjectName)).add(shift))-center(oldObjects.get(prior.id)).distanceToSquared(center(sourceObjects.get(b.sourceObjectName)).add(shift)));
  aliases[prior.id]=targets[0].id;redirects[prior.id]=targets.map(i=>i.id);
  changes.push({kind,removedId:prior.id,english:prior.english,side:prior.side,replacementIds:redirects[prior.id]});continue;
 }
 const support=/sheath/i.test(prior.english);
 const item={...prior,type:support?'support':prior.type,aggregate:false};
 if(item.type==='muscle'&&item.side==='midline'){
  const x=center(oldObjects.get(item.id)).x;
  item.side=x>0?'left':'right';item.sourceSideInferred=true;
  item.name=(x>0?'左':'右')+item.name;item.location=x>0?'左側（依模型座標）':'右側（依模型座標）';
 }
 const object=oldObjects.get(prior.id);object.removeFromParent();add(item,object);
 changes.push({kind:support?'reclassified-sheath':prior.type==='muscle'?'retained-source-only-muscle':'retained-nonmuscle',id:prior.id,english:prior.english});
}
if(items.filter(i=>i.source==='Z-Anatomy Startup'&&i.type==='muscle').length!==462)throw Error('Startup muscle coverage changed');
for(const item of items){
 const reviewed=reviewedClassification(item);
 if(!reviewed.keep)throw Error(`Out-of-scope structure survived: ${item.id}`);
 item.originalZones=[...item.zones];item.originalZone=item.zone;
 Object.assign(item,{system:reviewed.system,zone:reviewed.zone,zones:reviewed.zones,classificationReview:reviewed.review});
}
const groups=new Map();for(const child of scene.children)groups.set(child.name,child);
for(const item of items){
 const group=groups.get(item.id),extras={anatomyId:item.id,atlasRole:item.type,nameZh:item.name,nameEn:item.english,
  region:item.zone,zones:item.zones,system:item.system,source:item.source,aggregate:false,referenceId:item.referenceId,
  sourceObjectName:item.sourceObjectName??null};
 group.userData=extras;group.traverse(o=>{if(o.isMesh)o.userData=extras;});
}
scene.updateMatrixWorld(true);
const entries=items.map(item=>({item,group:groups.get(item.id),family:canonical(item.referenceId??item.english),box:new T.Box3().setFromObject(groups.get(item.id))}));
const muscles=entries.filter(e=>e.item.type==='muscle'),graph=new Map();
for(const e of muscles)graph.set(e.family,new Set());
for(let i=0;i<muscles.length;i++)for(let j=i+1;j<muscles.length;j++){
 const a=muscles[i],b=muscles[j];if(a.family===b.family)continue;
 if(Math.hypot(...['x','y','z'].map(axis=>Math.max(a.box.min[axis]-b.box.max[axis],b.box.min[axis]-a.box.max[axis],0)))<=.012){graph.get(a.family).add(b.family);graph.get(b.family).add(a.family);}
}
const colors=new Map();while(colors.size<graph.size){
 const sat=k=>new Set([...graph.get(k)].filter(n=>colors.has(n)).map(n=>colors.get(n))).size;
 const key=[...graph.keys()].filter(k=>!colors.has(k)).sort((a,b)=>sat(b)-sat(a)||graph.get(b).size-graph.get(a).size||a.localeCompare(b,'en'))[0];
 const used=new Set([...graph.get(key)].map(k=>colors.get(k)));let index=0;while(used.has(index))index++;colors.set(key,index);
}
const palette=['#c96b73','#568ebc','#68a38c','#c7a258','#9577b3','#c77e9e','#5ca5ac','#b68c6a','#7f9e53','#777ab7','#ba7659','#6d9cba'];
for(const {item,group,family}of entries){
 const index=colors.get(family)??0,color=item.type==='bone'?new T.Color('#dfd3bb'):item.type==='support'?new T.Color('#adb9c7'):index<palette.length?new T.Color(palette[index]):new T.Color().setHSL((index*.61803398875)%1,.58,.54);
 const material=new T.MeshStandardMaterial({color,roughness:.67,metalness:.02,side:T.DoubleSide});
 group.traverse(o=>{if(o.isMesh)o.material=material;});group.userData.paletteIndex=index;
}
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:false});
await writeFile(path.join(output,'atlas.glb'),Buffer.from(binary));
const summary={sourceMuscles:462,sourceMuscleNames:232,totalObjects:items.length,muscles:items.filter(i=>i.type==='muscle').length,bones:items.filter(i=>i.type==='bone').length,support:items.filter(i=>i.type==='support').length,
 added:changes.filter(c=>c.kind==='added-missing-side').length,headBonesReplaced:changes.filter(c=>c.kind==="replaced-misaligned-head-bone").length,supportAdded:changes.filter(c=>c.kind==='added-support-structure').length,removed:changes.filter(c=>c.removedId).length,reclassified:changes.filter(c=>c.kind==='reclassified-sheath').length,sourceOnly:changes.filter(c=>c.kind==='retained-source-only-muscle').length};
const manifest={source:{file:'Startup.blend',sha256:sourceInfo.sha256,blender:sourceInfo.blender},previous:{asset:'trigger-point-combined/atlas.glb',sha256:createHash('sha256').update(await readFile(path.join(assets,'trigger-point-combined/atlas.glb'))).digest('hex')},summary,zones:ANATOMICAL_REGIONS,registration:previous.registration,items,aliases,redirects,excluded,changes,colors:Object.fromEntries(colors),adjacency:[...graph].flatMap(([a,ns])=>[...ns].filter(b=>a<b).map(b=>[a,b])),bytes:binary.byteLength};
await writeFile(path.join(output,'catalog.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(root,'frontend/apps/frontend/src/app/pages/muscles-page/active-anatomy.generated.ts'),`// Generated by npm run anatomy:reconcile-startup. See assets/anatomy/startup-reconciled/ATTRIBUTION.md.\nexport const ACTIVE_ZONES = ${JSON.stringify(ANATOMICAL_REGIONS)};\nexport const ACTIVE_ALIASES: Record<string,string> = ${JSON.stringify(aliases,null,2)};\nexport const ACTIVE_STRUCTURES = ${JSON.stringify(items,null,2)};\n`);
const rows=changes.filter(c=>c.kind!=='retained-nonmuscle').map(c=>`| ${c.kind} | ${c.id??c.removedId} | ${c.referenceId??c.english??c.sourceObjectName} | ${(c.replacementIds??[]).join(', ')||'—'} |`);
await writeFile(path.join(root,'docs/startup-muscle-reconciliation.md'),`# Startup.blend 肌肉整理\n\n原檔 SHA-256：\`${sourceInfo.sha256}\`。讀取時停用內嵌 Python，未儲存或覆寫原檔。\n\n## 結果\n\n- Startup 的 Muscles 集合扣除明確非肌肉後，有 232 種肌肉／分部、462 個左右側與中線物件，全數以原始網格匯入。\n- 新增 ${summary.added} 個先前缺少的側別；移除 ${summary.removed} 個同名同側重複或與細分部重疊的整組網格。左右側與不同分部不視為重複。\n- 補入 ${summary.supportAdded} 個帽狀腱膜物件（左右側），歸類為支持結構，可在前端點選並調整透明度。\n- ${summary.reclassified} 個腱鞘物件改歸支持結構，未刪除。\n- ${summary.sourceOnly} 個原來源獨有的頸部橫突間肌物件因 Startup 沒有精確對應而保留，未憑名稱猜測刪除。\n- 現在 ${summary.muscles} 肌肉、${summary.bones} 骨骼、${summary.support} 支持結構，共 ${summary.totalObjects} 個。保留原骨骼 ID，頭部 22 個骨骼改用同一份 Startup 網格，避免異來源頭骨蓋住枕肌；其餘骨骼保留原資料。\n\n## 方法與相容性\n\nStartup 是本次肌肉形狀與分部的權威來源。同一個肌肉／側別只保留一份；既有 FJ／TP ID 能沿用則沿用，新增部件使用 ZA ID。被整併的舊 ID 保存在 catalog.json 的 aliases（預設定位）與 redirects（完整候選）；重複整組的舊連結會定位到相同側別的一個細分部，不代表其餘分部不存在。\n\n新肌肉僅套用 Startup 原有世界矩陣、glTF 座標轉換及先前的單一平移，以保留現有骨骼的座標基準；沒有任意放大、雕塑或增加肌肉量。原來源之間仍有姿勢差異，這不是醫學影像配準。sourceSideInferred 記錄原檔未標 .l 的左頸髂肋肌：依同名 .r 與正 X 位置辨識，沒有新增假肌肉。\n\n保留六個部位分類，依解剖身份修正歸屬，跨部位結構保留多重分類；原分類存於 originalZone / originalZones。僅啟用肌筋膜與骨骼系統，5 個甲狀舌骨韌帶／膜物件不列入活躍模型，原始來源保留。完整對照見 [分類檢查](anatomy-classification-audit.md)。這次新增獨立資產 startup-reconciled，不覆寫之前兩份 GLB。肌肉部件以 Startup 網格取代既有同名網格；所以這裡的去重是來源權威下的解剖身份／分部整併，不宣稱不同來源頂點完全相同。\n\n## 完整變更\n\n| 動作 | ID | 肌肉／分部 | 取代後 ID（若多個則為分部） |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n## 重建\n\n在 frontend 執行 \`npm run anatomy:reconcile-startup\`，預設讀取 ../Z-Anatomy/Startup.blend。可傳入其他來源路徑，或設定 BLENDER_PATH。原始檔案與舊資產保留不修改。\n`);
console.log(JSON.stringify({...summary,classification:await writeClassificationAudit()},null,2));


