import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ANATOMICAL_REGIONS,reviewedClassification} from '../../frontend/scripts/anatomy-classification.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../../frontend/apps/frontend/src/assets/anatomy/startup-reconciled/catalog.json',import.meta.url)));
assert.deepEqual(data.zones,ANATOMICAL_REGIONS);assert.equal(Object.keys(data.zones).length,6);
assert.equal(data.items.filter(i=>i.system==='myofascial').length,474);
assert.equal(data.items.filter(i=>i.system==='skeletal').length,238);
assert.equal(data.items.length,712);assert.equal(data.excluded.length,5);
for(const item of data.items){
 assert.ok(item.system==='myofascial'||item.system==='skeletal');
 assert.ok(item.zones.length&&item.zones.every(z=>z in data.zones));
 assert.equal(new Set(item.zones).size,item.zones.length);assert.equal(item.zone,item.zones[0]);
 assert.ok(item.originalZones.length);assert.equal(item.classificationReview,'anatomical-region-review-2026-11-16');
 assert.deepEqual(item.zones,reviewedClassification(item).zones);
}
const cases={
 'Deep head of flexor pollicis brevis':'Zone_Forearm_Hand',
 'Superficial head of flexor pollicis brevis':'Zone_Forearm_Hand',
 'Oblique head of adductor pollicis':'Zone_Forearm_Hand',
 'Transverse head of adductor pollicis':'Zone_Forearm_Hand',
 'Extensor digitorum brevis':'Zone_Leg_Foot',
 'Oblique head of adductor hallucis':'Zone_Leg_Foot',
 'Transverse head of adductor hallucis':'Zone_Leg_Foot',
 'Inferior oblique muscle':'Zone_Head_Neck',
 'Superior oblique muscle':'Zone_Head_Neck',
 'Ary-epiglottic part of oblique arytenoid muscle':'Zone_Head_Neck',
 'Oblique part of cricothyroid muscle':'Zone_Head_Neck',
 'Rectus posterior major capitis muscle':'Zone_Head_Neck',
 'Rectus posterior minor capitis muscle':'Zone_Head_Neck',
 'Obliquus inferior capitis muscle':'Zone_Head_Neck',
 'Obliquus superior capitis muscle':'Zone_Head_Neck',
 'Semispinalis colli muscle':'Zone_Head_Neck',
 'Coccygeus muscle':'Zone_Pelvis_Thigh',
 'Iliococcygeus muscle':'Zone_Pelvis_Thigh',
 'Pubococcygeus muscle':'Zone_Pelvis_Thigh',
 'External anal sphincter':'Zone_Pelvis_Thigh',
 'Epicranial aponeurosis':'Zone_Head_Neck',
 'Cruciform part of fibrous sheath of digit of hand':'Zone_Forearm_Hand',
 'Synovial sheaths of digits of hand':'Zone_Forearm_Hand',
 'iliotibial tract':'Zone_Pelvis_Thigh',
};
for(const [name,zone]of Object.entries(cases)){
 const found=data.items.filter(i=>(i.referenceId??i.english).toLowerCase()===name.toLowerCase());
 assert.ok(found.length,`Missing regression case ${name}`);assert.ok(found.every(i=>i.zone===zone),name);
}
for(const family of new Set(data.items.filter(i=>i.type!=='bone').map(i=>i.referenceId??i.english))){
 const pair=data.items.filter(i=>(i.referenceId??i.english)===family&&i.type!=='bone');
 for(const item of pair)assert.deepEqual(item.zones,pair[0].zones,`Side-dependent classification ${family}`);
}
for(const item of data.items.filter(i=>i.type!=='bone')){
 if(/pollicis|of hand/i.test(item.english))assert.equal(item.zone,'Zone_Forearm_Hand');
 if(/hallucis|of foot/i.test(item.english))assert.equal(item.zone,'Zone_Leg_Foot');
}
assert.ok(data.items.filter(i=>i.referenceId==='Descending part of trapezius muscle').every(i=>i.zones.includes('Zone_Head_Neck')&&i.zones.includes('Zone_Spine_Thorax')));
assert.ok(data.items.filter(i=>i.english.toLowerCase()==='iliotibial tract').every(i=>i.zones.includes('Zone_Leg_Foot')));
console.log('PASS: all 474 myofascial / 238 skeletal objects assigned, six regions only, 24 known misclassification regressions, bilateral consistency, explicit cross-region memberships, five excluded non-myofascial supports.');
