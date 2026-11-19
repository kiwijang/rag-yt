import {createHash} from 'node:crypto';

// Exact spelling/synonym crosswalks, never fuzzy matching by Chinese label.
export const canonical = text => text.toLowerCase().replace(/^(left|right|l|r)\s+/, '')
  .replace(/[()-]/g, ' ').replace(/\bmuscles?\b/g, '').replace(/\s+/g, ' ').trim();
const aliases = {
  'deltoid acromial': 'Acromial part of deltoid muscle',
  'deltoid clavicular': 'Clavicular part of deltoid muscle',
  'deltoid spinal': 'Scapular spinal part of deltoid muscle',
  'biceps brachii long head': 'Long head of biceps brachii',
  'biceps brachii short head': 'Short head of biceps brachii',
  'biceps femoris long head': 'Long head of biceps femoris',
  'biceps femoris short head': 'Short head of biceps femoris',
  'triceps long head': 'Long head of triceps brachii',
  'triceps lateral head': 'Lateral head of triceps brachii',
  'triceps medial head': 'Medial head of triceps brachii',
  'gastrocnemius lateral': 'Lateral head of gastrocnemius',
  'gastrocnemius medial': 'Medial head of gastrocnemius',
  'trapezius ascending': 'Ascending part of trapezius muscle',
  'trapezius descending': 'Descending part of trapezius muscle',
  'trapezius transverse': 'Transverse part of trapezius muscle',
  'pectoralis major clavicular': 'Clavicular head of pectoralis major muscle',
  'pectoralis major sternocostal': 'Sternocostal head of pectoralis major muscle',
  'external oblique': 'External abdominal oblique muscle',
  'internal oblique': 'Internal abdominal oblique muscle',
  'external intercostal': 'External intercostal muscles',
  'internal intercostal': 'Internal intercostal muscles',
  'gemellus superior': 'Superior gemellus muscle',
  'levator palpebrae': 'Levator palpebrae superioris',
  'iliocostalis cervicis': 'Iliocostalis colli muscle',
  'longissimus cervicis': 'Longissimus colli muscle',
  'levatores costarum longi': 'Levatores longi costarum',
  'set of interspinales cervicis': 'Interspinales colli muscles',
  'set of interspinales lumborum': 'Interspinales lumborum muscles',
};
export const referenceName = english => canonical(aliases[canonical(english)] ?? english);
// A whole-muscle label is not evidence that an individually selectable part exists.
export const aggregateParts = {
  'digastric': ['Anterior belly of digastric muscle','Posterior belly of digastric muscle'],
  'pronator teres': ['Deep head of pronator teres','Superficial head of pronator teres'],
  'flexor carpi ulnaris': ['Humeral head of flexor carpi ulnaris','Ulnar head of flexor carpi ulnaris'],
  'extensor carpi ulnaris': ['Humeral head of extensor carpi ulnaris','Ulnar head of extensor carpi ulnaris'],
  'flexor digitorum superficialis': ['Humero-ulnar head of flexor digitorum superficialis','Radial head of flexor digitorum superficialis'],
  'flexor hallucis brevis': ['Lateral head of flexor hallucis brevis','Medial head of flexor hallucis brevis'],
  'scalene': ['Scalenus anterior muscle','Scalenus medius muscle','Scalenus posterior muscle'],
  'splenius': ['Splenius capitis muscle','Splenius colli muscle'],
  'multifidus': ['Multifidus colli muscle','Multifidus thoracis muscle','Multifidus lumborum muscle'],
  'semispinalis': ['Semispinalis colli muscle','Semispinalis thoracis muscle'],
  'pectoralis major': ['(Abdominal part of pectoralis major muscle)'],
};
// Tensor fasciae latae is a muscle named for its attachment to fascia, not fascia.
export const isSupport = name => !/\btensor fasciae latae\b/i.test(name) && /fascia|bursa|bursae|tendon|tendinous|ligament|septum|retinaculum|aponeurosis|tract|arch|tarsus|trochlea|linea alba|membrane/i.test(name);
export function readReference(binary, component) {
  const gltf=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)).toString());
  const zones=Object.fromEntries([...component.matchAll(/\{ name: '(Zone_[^']+)', label: '([^']+)'/g)].map(m=>[m[1],m[2]]));
  if(Object.keys(zones).length!==6) throw Error('Expected the six trigger-point zoneControls.');
  zones.Zone_Unassigned='未分類';
  const assigned=new Map();
  const walk=(i,zone='Zone_Unassigned')=>{const node=gltf.nodes[i];if(node.name?.startsWith('Zone_'))zone=node.name;assigned.set(i,zone);for(const child of node.children??[])walk(child,zone);};
  for(const i of gltf.scenes[gltf.scene??0].nodes)walk(i);
  const structures=new Map();let helpers=0;
  gltf.nodes.forEach((node,index)=>{
    if(node.mesh===undefined)return;
    if(/\.[gj](?:\.\d+)?$/.test(node.name)){helpers++;return;}
    const name=node.name.replace(/\.(?:l|r)(?:\.\d+)?$/,'').trim();
    const row=structures.get(name)??{id:name,english:name,type:isSupport(name)?'support':'muscle',zones:[],nodes:[],originalNames:[]};
    if(!row.zones.includes(assigned.get(index)))row.zones.push(assigned.get(index));
    row.nodes.push(index);row.originalNames.push(node.name);structures.set(name,row);
  });
  return {gltf,zones,structures:[...structures.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')),helpers,sha256:createHash('sha256').update(binary).digest('hex')};
}
export function compareReference(reference, baseline) {
  return reference.structures.map(ref=>{
    const matched=baseline.filter(item=>referenceName(item.english)===canonical(ref.id));
    const aggregate=baseline.filter(item=>(aggregateParts[canonical(item.english)]??[]).some(name=>canonical(name)===canonical(ref.id)));
    return {...ref,status:matched.length?'matched':ref.type==='support'?'support-not-added':aggregate.length?'subdivision-added':'missing-added',matchedIds:matched.map(x=>x.id),aggregateIds:aggregate.map(x=>x.id)};
  });
}
