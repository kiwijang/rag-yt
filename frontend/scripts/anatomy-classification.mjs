// Reviewed anatomical identities, not coordinate thresholds or fuzzy name matching.
// Six UI regions are a navigation convention. Secondary regions do not clone meshes.
import {canonical} from './trigger-point-reference.mjs';
export const ANATOMICAL_REGIONS={
 Zone_Head_Neck:'頭頸',Zone_Forearm_Hand:'前臂手部',Zone_Leg_Foot:'腿腳',
 Zone_Upper_Arm:'上臂肩部',Zone_Pelvis_Thigh:'骨盆大腿',Zone_Spine_Thorax:'脊胸腹',
};
const list=text=>text.trim().split('\n').map(s=>s.trim()).filter(Boolean);
const primaryGroups={
 Zone_Head_Neck:list(`
Anterior belly of digastric muscle
Ary-epiglottic part of oblique arytenoid muscle
Bucinator
Corrugator supercilii
Deep part of masseter
Depressor anguli oris
Depressor labii inferioris
Depressor septi nasi
Descending part of trapezius muscle
Epicranial aponeurosis
External part of thyro-arytenoid muscle
Frontalis muscle
Genioglossus muscle
Geniohyoid muscle
Hyoglossus muscle
Iliocostalis colli muscle
Inferior head of lateral pterygoid muscle
Inferior oblique muscle
Inferior pharyngeal constrictor
Inferior rectus muscle
Interspinales colli muscles
Lateral crico-arytenoid muscle
Lateral rectus muscle
Levator anguli oris
Levator labii superioris
Levator nasolabialis
Levator palpebrae superioris
Levator scapulae
Longissimus capitis muscle
Longissimus colli muscle
Longus capitis muscle
Longus colli muscle
Medial pterygoid muscle
Medial rectus muscle
Mentalis muscle
Middle pharyngeal constrictor
Multifidus colli muscle
Mylohyoid muscle
Nasalis muscle
Oblique part of cricothyroid muscle
Obliquus inferior capitis muscle
Obliquus superior capitis muscle
Occipitalis muscle
Omohyoid muscle
Orbicularis oris muscle
Orbital part of orbicularis oculi
Palatopharyngeus muscle
Palpebral part of orbicularis oculi
Platysma
Posterior belly of digastric muscle
Posterior crico-arytenoid muscle
Procerus muscle
Rectus anterior capitis muscle
Rectus lateralis capitis muscle
Rectus posterior major capitis muscle
Rectus posterior minor capitis muscle
Risorius muscle
Scalenus anterior muscle
Scalenus medius muscle
Scalenus posterior muscle
Semispinalis colli muscle
set of anterior cervical intertransversarii
set of posterior cervical intertransversarii
Spinalis capitis muscle
Spinalis colli muscle
Splenius capitis muscle
Splenius colli muscle
Sternocleidomastoid muscle
Sternohyoid muscle
Sternothyroid muscle
Straight part of cricothyroid muscle
Stylohyoid muscle
Stylopharyngeus muscle
Superficial part of masseter
Superior head of lateral pterygoid muscle
Superior oblique muscle
Superior pharyngeal constrictor
Superior rectus muscle
Temporalis muscle
Temporoparietalis muscle
Thyro-epiglottic part of thyro-arytenoid muscle
Thyrohyoid muscle
Transverse arytenoid muscle
Zygomaticus major muscle
Zygomaticus minor muscle
`),
 Zone_Upper_Arm:list(`
Acromial part of deltoid muscle
Brachialis muscle
Clavicular part of deltoid muscle
Coracobrachialis muscle
Infraspinatus muscle
Lateral head of triceps brachii
Long head of biceps brachii
Long head of triceps brachii
Medial head of triceps brachii
Scapular spinal part of deltoid muscle
Short head of biceps brachii
Subclavius muscle
Subscapularis muscle
Supraspinatus muscle
Teres major muscle
Teres minor muscle
`),
 Zone_Forearm_Hand:list(`
Abductor digiti minimi of hand
Abductor pollicis brevis
Abductor pollicis longus
Anconeus muscle
Brachioradialis muscle
Cruciform part of fibrous sheath of digit of hand
Deep head of flexor pollicis brevis
Deep head of pronator teres
Dorsal interossei muscles of hand
Extensor carpi radialis brevis
Extensor carpi radialis longus
Extensor digiti minimi
Extensor digitorum
Extensor indicis
Extensor pollicis brevis
Extensor pollicis longus
Flexor carpi radialis
Flexor digiti minimi of hand
Flexor digitorum profundus
Flexor pollicis longus
Humeral head of extensor carpi ulnaris
Humeral head of flexor carpi ulnaris
Humero-ulnar head of flexor digitorum superficialis
Lumbrical muscles of hand
Oblique head of adductor pollicis
Opponens digiti minimi muscle of hand
Opponens pollicis muscle
Palmar interossei muscles
Palmaris longus muscle
Pronator quadratus
Radial head of flexor digitorum superficialis
Superficial head of flexor pollicis brevis
Superficial head of pronator teres
Supinator
Synovial sheaths of digits of hand
Transverse head of adductor pollicis
Ulnar head of extensor carpi ulnaris
Ulnar head of flexor carpi ulnaris
`),
 Zone_Spine_Thorax:list(`
(Abdominal part of pectoralis major muscle)
Ascending part of trapezius muscle
Clavicular head of pectoralis major muscle
Diaphragm
Dorsal parts of lateral intertransversarii lumborum muscles
External abdominal oblique muscle
External intercostal muscles
Iliocostalis lumborum muscle
Iliocostalis thoracis muscle
Innermost intercostal muscles
Internal abdominal oblique muscle
Internal intercostal muscles
Interspinales lumborum muscles
Interspinales thoracis muscles
Latissimus dorsi muscle
Levatores breves costarum
Levatores longi costarum
Longissimus thoracis muscle
Multifidus lumborum muscle
Multifidus thoracis muscle
Pectoralis minor muscle
Pyramidalis muscle
Quadratus lumborum muscle
Rectus abdominis muscle
Rhomboid major muscle
Rhomboid minor muscle
Rotatores
Semispinalis thoracis muscle
Serratus anterior muscle
Serratus posterior inferior muscle
Serratus posterior superior muscle
Spinalis thoracis muscle
Sternocostal head of pectoralis major muscle
Transverse part of trapezius muscle
Transversus abdominis muscle
Transversus thoracis muscle
Ventral parts of lateral intertransversarii lumborum muscles
`),
 Zone_Pelvis_Thigh:list(`
(Adductor minimus)
Adductor brevis
Adductor longus
Adductor magnus
Coccygeus muscle
External anal sphincter
Gluteus maximus muscle
Gluteus medius muscle
Gluteus minimus muscle
Gracilis muscle
Iliacus muscle
Iliococcygeus muscle
Iliotibial tract
Inferior gemellus muscle
Long head of biceps femoris
Obturator externus
Obturator internus
Pectineus muscle
Piriformis muscle
Psoas major
Pubo-analis muscle
Pubococcygeus muscle
Quadratus femoris muscle
Rectus femoris muscle
Sartorius muscle
Semimembranosus muscle
Semitendinosus muscle
Short head of biceps femoris
Superior gemellus muscle
Tensor fasciae latae
Vastus intermedius muscle
Vastus lateralis muscle
Vastus medialis muscle
`),
 Zone_Leg_Foot:list(`
(Opponens digiti minimi muscle of foot)
Abductor digiti minimi of foot
Abductor hallucis
Dorsal interossei muscles of foot
Extensor digitorum brevis
Extensor digitorum longus
Extensor hallucis brevis
Extensor hallucis longus
Fibularis brevis muscle
Fibularis longus muscle
Fibularis tertius muscle
Flexor digiti minimi of foot
Flexor digitorum brevis
Flexor digitorum longus
Flexor hallucis longus
Lateral head of flexor hallucis brevis
Lateral head of gastrocnemius
Lumbrical muscles of foot
Medial head of flexor hallucis brevis
Medial head of gastrocnemius
Oblique head of adductor hallucis
Plantar interossei muscles
Plantaris muscle
Popliteus muscle
Quadratus plantae muscle
Soleus muscle
Tibialis anterior muscle
Tibialis posterior muscle
Transverse head of adductor hallucis
`),
};
const primary=new Map();
for(const [zone,names]of Object.entries(primaryGroups))for(const name of names){
 const key=canonical(name);if(primary.has(key))throw Error(`Duplicate anatomical assignment: ${name}`);primary.set(key,zone);
}
const secondary={
 Zone_Spine_Thorax:list(`Iliocostalis colli muscle
Longissimus capitis muscle
Longissimus colli muscle
Semispinalis colli muscle
Spinalis capitis muscle
Spinalis colli muscle
Splenius capitis muscle
Splenius colli muscle
Descending part of trapezius muscle
Psoas major`),
 Zone_Upper_Arm:list(`Descending part of trapezius muscle
Ascending part of trapezius muscle
Transverse part of trapezius muscle
Levator scapulae
(Abdominal part of pectoralis major muscle)
Clavicular head of pectoralis major muscle
Sternocostal head of pectoralis major muscle
Pectoralis minor muscle
Serratus anterior muscle
Rhomboid major muscle
Rhomboid minor muscle
Latissimus dorsi muscle`),
 Zone_Leg_Foot:['Iliotibial tract'],
};
const excludedSupports=new Set(['thyrohyoid ligament','thyrohyoid membrane']);
export function scopeDecision(item){
 if(item.type==='bone')return {system:'skeletal',keep:true};
 if(excludedSupports.has(canonical(item.english)))return {system:'other',keep:false,reason:'甲狀舌骨韌帶／膜，不列入肌筋膜系統'};
 if(item.type==='muscle'||item.type==='support')return {system:'myofascial',keep:true};
 return {system:'other',keep:false,reason:'不屬肌筋膜或骨骼系統'};
}
function boneZone(english){
 const n=canonical(english);
 if(/cervical vertebra|intervertebral disk c\d|hyoid|ethmoid|frontal bone|inferior nasal concha|lacrimal|maxilla|nasal bone|palatine|parietal|temporal bone|zygomatic|mandible|nasal septum|occipital bone|sphenoid|vomer/.test(n))return 'Zone_Head_Neck';
 if(/thoracic vertebra|lumbar vertebra|intervertebral disk [tl]\d|\brib\b|sternum/.test(n))return 'Zone_Spine_Thorax';
 if(/clavicle|scapula|humerus/.test(n))return 'Zone_Upper_Arm';
 if(/hip bone|femur|sacrum/.test(n))return 'Zone_Pelvis_Thigh';
 // Keep the legacy pelvic reference mesh with the requested skeleton. Its
 // imprecise source label is not grounds for deleting or renaming its geometry.
 if(n==='pubic region')return 'Zone_Pelvis_Thigh';
 if(/tibia|fibula|patella|calcaneus|cuboid|cuneiform|navicular|talus|metatarsal|\btoe\b/.test(n))return 'Zone_Leg_Foot';
 if(/radius|ulna|capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|metacarpal|phalanx/.test(n))return 'Zone_Forearm_Hand';
 throw Error(`Bone has no reviewed region: ${english}`);
}
export function reviewedClassification(item){
 const scope=scopeDecision(item);
 if(!scope.keep)return scope;
 const key=canonical(item.referenceId??item.english),zone=item.type==='bone'?boneZone(item.english):primary.get(key);
 if(!zone)throw Error(`Missing anatomical classification: ${item.id} ${key}`);
 const zones=[zone];
 if(item.type!=='bone')for(const [extra,names]of Object.entries(secondary))if(extra!==zone&&names.some(n=>canonical(n)===key))zones.push(extra);
 return {...scope,zone,zones,review:'anatomical-region-review-2026-11-16'};
}
