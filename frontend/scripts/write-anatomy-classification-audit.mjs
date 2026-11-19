import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canonical} from './trigger-point-reference.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function writeClassificationAudit(){
 const manifest=JSON.parse(await readFile(path.join(root,'frontend/apps/frontend/src/assets/anatomy/startup-reconciled/catalog.json'),'utf8'));
 const items=manifest.items.filter(i=>i.system==='myofascial');
 const unassigned=items.filter(i=>i.originalZones.includes('Zone_Unassigned')).length;
 const moved=items.filter(i=>!i.originalZones.includes('Zone_Unassigned')&&i.originalZone!==i.zone).length;
 const cross=items.filter(i=>i.zones.length>1).length;
 const oldNames={...manifest.zones,Zone_Unassigned:'未分類'};
 const families=new Map();
 for(const item of items){const key=item.type+'|'+canonical(item.referenceId??item.english);if(!families.has(key))families.set(key,[]);families.get(key).push(item);}
 const rows=[...families.values()].sort((a,b)=>(a[0].referenceId??a[0].english).localeCompare(b[0].referenceId??b[0].english,'en')).map(group=>{
  const item=group[0],old=[...new Set(group.flatMap(i=>i.originalZones))];
  const status=old.includes('Zone_Unassigned')?'補齊未分類':item.originalZone!==item.zone?'修正主分類':item.zones.length>1?'補充跨部位':'確認原分類';
  return `| ${item.name.replace(/^[左右]/,'')} | ${item.referenceId??item.english} | ${item.type==='muscle'?'肌肉':'筋膜相關'} | ${old.map(z=>oldNames[z]).join('、')} | ${item.zones.map(z=>manifest.zones[z]).join('、')} | ${group.length} | ${status} |`;
 });
 const regions=Object.entries(manifest.zones).map(([id,name])=>`| ${name} | ${items.filter(i=>i.zone===id).length} | ${items.filter(i=>i.zones.includes(id)).length} | ${manifest.items.filter(i=>i.system==='skeletal'&&i.zone===id).length} |`);
 const text=`# 肌筋膜與骨骼分類審核\n\n依使用者要求：保留目前六大部位，分類改依實際解剖部位；前端僅保留肌筋膜系統與骨骼系統。原本 trigger-point 分類保存在每個物件的 originalZone / originalZones，不改寫來源模型。\n\n## 結果\n\n- 肌筋膜系統 ${items.length} 個物件：${manifest.summary.muscles} 肌肉、${manifest.summary.support} 筋膜／腱膜／腱鞘相關結構，合計 ${families.size} 種英文解剖身份。\n- 原未分類 ${unassigned} 個已補齊；原有主分類錯置 ${moved} 個已修正。\n- ${cross} 個跨部位物件有多個相關分類，同一網格沒有複製；跨部位數字可能與前述修正數重疊。\n- 全部物件均有明列分類，不再保留未分類選項。未知的新身份會令產生程序失敗，必須先審核，避免靜默落入其他區。\n- 骨骼系統保留 ${manifest.summary.bones} 個原骨架構件與 ID，也配合六大部位篩選。骨架含來源原有軟骨、椎間盤及參考件；此數字不是人體骨頭總數，原來源的 Pubic region 參考件保留且不臆改名稱。\n- 排除 ${manifest.excluded.length} 個甲狀舌骨韌帶／膜物件，它們不列入肌筋膜系統。原始資料與歷史資產保留，沒有刪除資料庫紀錄。\n\n## 六大部位的界線\n\n六類是本專案的導覽分組，不是宣稱存在唯一的六分法。主分類依肌腹或筋膜的主要所在區域；明確跨越頸背、胸肩、腰髖等部位時增加附分類。僅有遠端肌腱附著或牽涉痛關聯，不據此把整個肌肉任意分到其他區域。\n\n- 頭頸：頭皮、顏面、眼、咀嚼、舌／咽／喉、枕下與頸部；因此頸後肌不再只留在脊胸腹。\n- 前臂手部：肘／前臂、腕與手，包含拇指及手內在肌。\n- 腿腳：膝後、小腿、踝及足，包含拇趾與足內在肌；不是前臂手部。\n- 上臂肩部：肩帶、肩關節周邊、上臂。\n- 骨盆大腿：骨盆、骨盆底／會陰、臀髖與大腿。\n- 脊胸腹：胸腰背、胸壁與腹壁；部分胸肩、頸背或腰髖肌肉有附分類。\n\n胸大肌、背闊肌等主要位於胸背，但也延展至肩帶，可於肩部找到；斜方肌降部、頭夾肌等可於頭頸與相鄰區找到。骨架的膝蓋骨分在腿腳，其骨盆與股骨分在骨盆大腿。\n\n## 分類計數\n\n「主分類」每個物件只算一次；「可見分類」計入跨部位，因此總和可超過肌筋膜物件數。\n\n| 部位 | 肌筋膜主分類物件 | 肌筋膜可見分類物件 | 骨架主分類物件 |\n| --- | --- | --- | --- |\n${regions.join('\n')}\n\n## 全部肌肉與筋膜身份對照\n\n| 中文名稱（省略左右） | 英文身份 | 類型 | 原分類 | 修正後分類（首項為主類） | 左右／中線物件數 | 結果 |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## 排除範圍\n\n| ID | 原英文資料 | 原顯示名稱 | 原因 |\n| --- | --- | --- | --- |\n${manifest.excluded.map(i=>`| ${i.id} | ${i.english} | ${i.name} | ${i.reason} |`).join('\n')}\n\n這些項目原本顯示成甲狀舌骨肌，但其英文資料是 ligament / membrane，與 Thyrohyoid muscle 的兩個真正肌肉網格分開處理；真正甲狀舌骨肌仍保留在頭頸。\n\n## 來源與實作\n\n部位整理參照 [OpenStax 頭頸與背部](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back)、[胸腹壁](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax)、[肩帶及上肢](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs)、[骨盆帶及下肢](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs)，筋膜相關結構另參照 [髂脛束](https://www.ncbi.nlm.nih.gov/books/NBK537097/) 與 [頭皮／帽狀腱膜](https://www.ncbi.nlm.nih.gov/books/NBK551565/)。六大部位及附分類為本專案按以上解剖區域整理的介面對照，不是直接複製任何來源的分類表。\n\nfrontend/scripts/anatomy-classification.mjs 是唯一的人工部位對照，沒有用中文包含頭、手、足等字眼做模糊分類。產生器將同一份結果寫入 GLB extras 與 Angular catalog；清單、三維顯示與爆炸圖使用相同 zones，避免看得到清單卻看不到模型。\n\ntests/Anatomy.Checks/check-classification.mjs 驗證已知錯分案例、全部身份覆蓋、左右一致、跨部位與排除範圍；幾何驗證確認本次只改分類／範圍，保留網格頂點。\n`;
 await writeFile(path.join(root,'docs/anatomy-classification-audit.md'),text);
 return {myofascial:items.length,skeletal:manifest.summary.bones,unassignedFixed:unassigned,wrongPrimaryFixed:moved,crossRegion:cross,excluded:manifest.excluded.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await writeClassificationAudit());
