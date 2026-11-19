import { ANATOMY_ITEMS, AnatomyStructure } from '../muscles-page/muscle-catalog';
import { SOURCE_MUSCLES, SYMPTOM_RELATIONS } from './symptom-relations.generated';

export type BodyView = 'front' | 'back';
export type SymptomRegion = { id: string; name: string; english: string; hint: string; box: string; color: string };
export type SymptomLocation = { id: string; region: string; name: string; view: BodyView; x: number; y: number; sourceUrl: string; primary: string[]; secondary: string[] };
export const SYMPTOM_REGIONS: SymptomRegion[] = [
  {id:'head-and-neck',name:'頭頸',english:'Head and Neck',hint:'後腦、頸後、太陽穴',box:'106 14 108 112',color:'#8b5cf6'},
  {id:'upper-back-shoulder-and-arm',name:'上背、肩與上臂',english:'Upper Back, Shoulder, and Arm',hint:'肩前側、肩後側、上臂前側',box:'70 94 180 142',color:'#f59e0b'},
  {id:'forearm-hand-pain',name:'前臂與手',english:'Forearm & Hand',hint:'肘外側、肘內側、手腕掌側',box:'32 178 256 184',color:'#0ea5e9'},
  {id:'torso',name:'軀幹',english:'Torso',hint:'前胸、側胸、腹部',box:'102 106 116 178',color:'#14b8a6'},
  {id:'lower-torso',name:'下軀幹',english:'Lower Torso',hint:'腰部、臀部、鼠蹊部',box:'94 234 132 138',color:'#e879a8'},
  {id:'hip-thigh-knee',name:'髖、大腿與膝',english:'Hip, Thigh & Knee',hint:'大腿前側、髖外側、膝前側',box:'94 290 132 174',color:'#6366f1'},
  {id:'leg-ankle-foot',name:'小腿、踝與足',english:'Leg, Ankle & Foot',hint:'小腿後側、足跟、足底中段',box:'92 412 136 190',color:'#22a06b'},
];
// Original schematic positions, not trigger-point locations or source image-map coordinates.
const LOCATIONS: [string,string,string,BodyView,number,number][] = [
  ['back-head-pain','head-and-neck','後腦疼痛','back',160,51],
  ['back-neck-pain','head-and-neck','頸後疼痛','back',160,103],
  ['temporal-headache-temples','head-and-neck','太陽穴疼痛','front',182,55],
  ['front-shoulder-pain','upper-back-shoulder-and-arm','肩前側疼痛','front',194,133],
  ['back-shoulder-pain','upper-back-shoulder-and-arm','肩後側疼痛','back',192,143],
  ['front-arm-pain','upper-back-shoulder-and-arm','上臂前側疼痛','front',213,185],
  ['lateral-epicondylar-pain','forearm-hand-pain','肘外側疼痛','front',221,217],
  ['medial-epicondylar-pain','forearm-hand-pain','肘內側疼痛','front',197,218],
  ['volar-wrist-palmar-pain','forearm-hand-pain','手腕與手掌側疼痛','front',249,301],
  ['front-chest-pain','torso','前胸疼痛','front',151,155],
  ['side-chest-pain','torso','側胸疼痛','front',190,193],
  ['abdominal-pain','torso','腹部疼痛','front',160,240],
  ['lumbar-pain','lower-torso','腰部疼痛','back',160,258],
  ['buttock-pain','lower-torso','臀部疼痛','back',183,322],
  ['groin-pain','lower-torso','鼠蹊部疼痛','front',177,302],
  ['anterior-thigh-pain','hip-thigh-knee','大腿前側疼痛','front',181,365],
  ['lateral-thigh-hip-pain','hip-thigh-knee','髖與大腿外側疼痛','front',199,333],
  ['anterior-knee-pain','hip-thigh-knee','膝前側疼痛','front',186,435],
  ['posterior-leg-calf-pain','leg-ankle-foot','小腿後側疼痛','back',185,481],
  ['heel-pain','leg-ankle-foot','足跟疼痛','back',188,565],
  ['plantar-midfoot-pain','leg-ankle-foot','足底中段疼痛','front',202,584],
];
export const SYMPTOM_LOCATIONS: SymptomLocation[] = LOCATIONS.map(([id,region,name,view,x,y]) => {
  const relation = SYMPTOM_RELATIONS.find(row => row.id === id);
  if (!relation) throw Error(`Missing symptom reference: ${id}`);
  return {...relation,id,region,name,view,x,y};
});
const CHINESE: Record<string,string> = {
  'abdominal-obliques':'腹斜肌群','abductor-hallucis':'拇趾外展肌','adductor-longus-and-brevis':'長收肌與短收肌',
  'adductor-magnus':'大收肌','anconeus':'肘肌','biceps-brachii':'肱二頭肌','brachialis':'肱肌','brachioradialis':'肱橈肌',
  'coracobrachialis':'喙肱肌','deltoid':'三角肌','digastric':'二腹肌','extensor-carpi-radialis-longus':'橈側伸腕長肌',
  'extensor-digitorum':'伸指肌','flexor-carpi-radialis':'橈側屈腕肌','flexor-carpi-ulnaris':'尺側屈腕肌',
  'flexor-digitorum-longus':'屈趾長肌','gastrocnemius':'腓腸肌','gluteus-maximus':'臀大肌','gluteus-medius':'臀中肌',
  'gluteus-minimus':'臀小肌','iliocostalis-lumborum':'腰髂肋肌','iliocostalis-thoracis':'胸髂肋肌','iliopsoas':'髂腰肌群',
  'infraspinatus':'棘下肌','intercostals':'肋間肌群','interossei-foot':'足部骨間肌群','latissimus-dorsi':'背闊肌',
  'levator-scapulae':'提肩胛肌','longissimus-thoracis':'胸最長肌','multifidi':'多裂肌群','occipitalis':'枕肌',
  'opponens-pollicis':'拇指對掌肌','palmaris-longus':'掌長肌','pectineus':'恥骨肌','pectoralis-major':'胸大肌',
  'pectoralis-minimus':'Pectoralis Minimus（來源名稱）','piriformis':'梨狀肌','plantaris':'蹠肌','pronator-teres':'旋前圓肌',
  'pyramidalis':'錐狀肌','quadratus-lumborum':'腰方肌','quadratus-plantae':'足底方肌','rectus-abdominis':'腹直肌',
  'rectus-femoris':'股直肌','sartorius':'縫匠肌','scalene':'斜角肌群','semimembranosus':'半膜肌',
  'semispinalis-capitis':'頭半棘肌','semitendinosus':'半腱肌','serratus-anterior':'前鋸肌',
  'serratus-posterior-superior':'上後鋸肌','soleus':'比目魚肌','splenius-cervicis':'頸夾肌','sternalis':'胸骨肌',
  'sternocleidomastoid':'胸鎖乳突肌','subclavius':'鎖骨下肌','suboccipital-group':'枕下肌群','subscapularis':'肩胛下肌',
  'supinator':'旋後肌','supraspinatus':'棘上肌','temporalis':'顳肌','tensor-fasciae-latae':'闊筋膜張肌',
  'teres-major':'大圓肌','teres-minor':'小圓肌','tibialis-posterior':'脛後肌','trapezius':'斜方肌',
  'triceps-brachii':'肱三頭肌','vastus-intermedius':'股中間肌','vastus-lateralis':'股外側肌','vastus-medialis':'股內側肌',
};
const PARTS: Record<string,string[]> = {
  'abdominal-obliques':['External abdominal oblique','Internal abdominal oblique'],
  'adductor-longus-and-brevis':['Adductor longus','Adductor brevis'],
  'biceps-brachii':['Long head of biceps brachii','Short head of biceps brachii'],
  'triceps-brachii':['Long head of triceps brachii','Medial head of triceps brachii','Lateral head of triceps brachii'],
  'deltoid':['Acromial part of deltoid','Clavicular part of deltoid','Scapular spinal part of deltoid'],
  'digastric':['Anterior belly of digastric','Posterior belly of digastric'],
  'gastrocnemius':['Lateral head of gastrocnemius','Medial head of gastrocnemius'],
  'flexor-carpi-ulnaris':['Humeral head of flexor carpi ulnaris','Ulnar head of flexor carpi ulnaris'],
  'iliopsoas':['Iliacus','Psoas major'],
  'intercostals':['External intercostal','Internal intercostal','Innermost intercostal'],
  'interossei-foot':['Dorsal interossei of foot','Plantar interossei'],
  'multifidi':['Multifidus colli','Multifidus thoracis','Multifidus lumborum'],
  'pectoralis-major':['Clavicular head of pectoralis major','Sternocostal head of pectoralis major','Abdominal part of pectoralis major'],
  'pronator-teres':['Deep head of pronator teres','Superficial head of pronator teres'],
  'scalene':['Scalenus anterior','Scalenus medius','Scalenus posterior'],
  'splenius-cervicis':['Splenius colli'],
  'suboccipital-group':['Rectus posterior major capitis','Rectus posterior minor capitis','Obliquus inferior capitis','Obliquus superior capitis'],
  'trapezius':['Ascending part of trapezius','Descending part of trapezius','Transverse part of trapezius'],
};
const normalize = (name: string) => name.toLowerCase().replace(/^(left|right|l|r)\s+/, '').replace(/\bmuscles?\b/g,'').replace(/[()-]/g,' ').replace(/\s+/g,' ').trim();
export type RelatedMuscle = { id: string; name: string; english: string; sourceUrl: string; models: AnatomyStructure[] };
export const RELATED_MUSCLES: RelatedMuscle[] = SOURCE_MUSCLES.map(row => {
  const names = (PARTS[row.id] ?? [row.english]).map(normalize);
  return {...row,name:CHINESE[row.id]??row.english,sourceUrl:`https://www.triggerpoints.net/muscle/${row.id}`,
    models:ANATOMY_ITEMS.filter(item => item.type==='muscle' && !item.aggregate && names.includes(normalize(item.referenceId??item.english)))
      .sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')||a.id.localeCompare(b.id))};
});
