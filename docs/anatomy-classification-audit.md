# 肌筋膜與骨骼分類審核

依使用者要求：保留目前六大部位，分類改依實際解剖部位；前端僅保留肌筋膜系統與骨骼系統。原本 trigger-point 分類保存在每個物件的 originalZone / originalZones，不改寫來源模型。

## 結果

- 肌筋膜系統 474 個物件：466 肌肉、8 筋膜／腱膜／腱鞘相關結構，合計 238 種英文解剖身份。
- 原未分類 219 個已補齊；原有主分類錯置 46 個已修正。
- 44 個跨部位物件有多個相關分類，同一網格沒有複製；跨部位數字可能與前述修正數重疊。
- 全部物件均有明列分類，不再保留未分類選項。未知的新身份會令產生程序失敗，必須先審核，避免靜默落入其他區。
- 骨骼系統保留 238 個原骨架構件與 ID，也配合六大部位篩選。骨架含來源原有軟骨、椎間盤及參考件；此數字不是人體骨頭總數，原來源的 Pubic region 參考件保留且不臆改名稱。
- 排除 5 個甲狀舌骨韌帶／膜物件，它們不列入肌筋膜系統。原始資料與歷史資產保留，沒有刪除資料庫紀錄。

## 六大部位的界線

六類是本專案的導覽分組，不是宣稱存在唯一的六分法。主分類依肌腹或筋膜的主要所在區域；明確跨越頸背、胸肩、腰髖等部位時增加附分類。僅有遠端肌腱附著或牽涉痛關聯，不據此把整個肌肉任意分到其他區域。

- 頭頸：頭皮、顏面、眼、咀嚼、舌／咽／喉、枕下與頸部；因此頸後肌不再只留在脊胸腹。
- 前臂手部：肘／前臂、腕與手，包含拇指及手內在肌。
- 腿腳：膝後、小腿、踝及足，包含拇趾與足內在肌；不是前臂手部。
- 上臂肩部：肩帶、肩關節周邊、上臂。
- 骨盆大腿：骨盆、骨盆底／會陰、臀髖與大腿。
- 脊胸腹：胸腰背、胸壁與腹壁；部分胸肩、頸背或腰髖肌肉有附分類。

胸大肌、背闊肌等主要位於胸背，但也延展至肩帶，可於肩部找到；斜方肌降部、頭夾肌等可於頭頸與相鄰區找到。骨架的膝蓋骨分在腿腳，其骨盆與股骨分在骨盆大腿。

## 分類計數

「主分類」每個物件只算一次；「可見分類」計入跨部位，因此總和可超過肌筋膜物件數。

| 部位 | 肌筋膜主分類物件 | 肌筋膜可見分類物件 | 骨架主分類物件 |
| --- | --- | --- | --- |
| 頭頸 | 169 | 169 | 38 |
| 前臂手部 | 76 | 76 | 56 |
| 腿腳 | 58 | 60 | 58 |
| 上臂肩部 | 32 | 56 | 6 |
| 骨盆大腿 | 66 | 66 | 6 |
| 脊胸腹 | 73 | 93 | 74 |

## 全部肌肉與筋膜身份對照

| 中文名稱（省略左右） | 英文身份 | 類型 | 原分類 | 修正後分類（首項為主類） | 左右／中線物件數 | 結果 |
| --- | --- | --- | --- | --- | --- | --- |
| 胸大肌腹部 | (Abdominal part of pectoralis major muscle) | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 小收肌 | (Adductor minimus) | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 足小趾對掌肌 | (Opponens digiti minimi muscle of foot) | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 足小趾外展肌 | Abductor digiti minimi of foot | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 手小指外展肌 | Abductor digiti minimi of hand | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 拇趾外展肌 | Abductor hallucis | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 拇指短外展肌 | Abductor pollicis brevis | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 拇指長外展肌 | Abductor pollicis longus | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 三角肌肩峰部 | Acromial part of deltoid muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 短收肌 | Adductor brevis | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 長收肌 | Adductor longus | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 大收肌 | Adductor magnus | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 肘肌 | Anconeus muscle | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 二腹肌前腹 | Anterior belly of digastric muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 杓斜肌杓會厭部 | Ary-epiglottic part of oblique arytenoid muscle | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 斜方肌升部 | Ascending part of trapezius muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 肱肌 | Brachialis muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 肱橈肌 | Brachioradialis muscle | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 頰肌 | Bucinator | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 胸大肌鎖骨頭 | Clavicular head of pectoralis major muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 三角肌鎖骨部 | Clavicular part of deltoid muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 尾骨肌 | Coccygeus muscle | 肌肉 | 脊胸腹 | 骨盆大腿 | 2 | 修正主分類 |
| 喙肱肌 | Coracobrachialis muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 皺眉肌 | Corrugator supercilii | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 手指纖維鞘交叉部 | Cruciform part of fibrous sheath of digit of hand | 筋膜相關 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 拇指短屈肌深頭 | Deep head of flexor pollicis brevis | 肌肉 | 頭頸 | 前臂手部 | 2 | 修正主分類 |
| 旋前圓肌深頭 | Deep head of pronator teres | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 咬肌深部 | Deep part of masseter | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 降口角肌 | Depressor anguli oris | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 降下唇肌 | Depressor labii inferioris | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 降鼻中隔肌 | Depressor septi nasi | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 斜方肌降部 | Descending part of trapezius muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹、上臂肩部 | 2 | 修正主分類 |
| 橫膈肌 | Diaphragm | 肌肉 | 脊胸腹 | 脊胸腹 | 1 | 確認原分類 |
| 足背側骨間肌 | Dorsal interossei muscles of foot | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 手背側骨間肌 | Dorsal interossei muscles of hand | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 腰外側橫突間肌背側部 | Dorsal parts of lateral intertransversarii lumborum muscles | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 帽狀腱膜 | Epicranial aponeurosis | 筋膜相關 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 橈側伸腕短肌 | Extensor carpi radialis brevis | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 橈側伸腕長肌 | Extensor carpi radialis longus | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 小指伸肌 | Extensor digiti minimi | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 伸指肌 | Extensor digitorum | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 趾短伸肌 | Extensor digitorum brevis | 肌肉 | 前臂手部 | 腿腳 | 2 | 修正主分類 |
| 趾長伸肌 | Extensor digitorum longus | 肌肉 | 腿腳 | 腿腳 | 2 | 確認原分類 |
| 拇趾短伸肌 | Extensor hallucis brevis | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 拇趾長伸肌 | Extensor hallucis longus | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 食指伸肌 | Extensor indicis | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 拇指短伸肌 | Extensor pollicis brevis | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 拇指長伸肌 | Extensor pollicis longus | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 腹外斜肌 | External abdominal oblique muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 肛門外括約肌 | External anal sphincter | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 肋間外肌 | External intercostal muscles | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 甲杓肌外側部 | External part of thyro-arytenoid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 腓骨短肌 | Fibularis brevis muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 腓骨長肌 | Fibularis longus muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 第三腓骨肌 | Fibularis tertius muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 橈側屈腕肌 | Flexor carpi radialis | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 足小趾短屈肌 | Flexor digiti minimi of foot | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 手小指短屈肌 | Flexor digiti minimi of hand | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 趾短屈肌 | Flexor digitorum brevis | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 趾長屈肌 | Flexor digitorum longus | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 深屈指肌 | Flexor digitorum profundus | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 拇趾長屈肌 | Flexor hallucis longus | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 拇指長屈肌 | Flexor pollicis longus | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 額肌 | Frontalis muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 頦舌肌 | Genioglossus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頦舌骨肌 | Geniohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 臀大肌 | Gluteus maximus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 臀中肌 | Gluteus medius muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 臀小肌 | Gluteus minimus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 股薄肌 | Gracilis muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 尺側伸腕肌肱骨頭 | Humeral head of extensor carpi ulnaris | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 尺側屈腕肌肱骨頭 | Humeral head of flexor carpi ulnaris | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 淺屈指肌肱尺頭 | Humero-ulnar head of flexor digitorum superficialis | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 舌骨舌肌 | Hyoglossus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 髂肌 | Iliacus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 髂尾肌 | Iliococcygeus muscle | 肌肉 | 脊胸腹 | 骨盆大腿 | 2 | 修正主分類 |
| 頸髂肋肌 | Iliocostalis colli muscle | 肌肉 | 未分類 | 頭頸、脊胸腹 | 2 | 補齊未分類 |
| 腰髂肋肌 | Iliocostalis lumborum muscle | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 胸髂肋肌 | Iliocostalis thoracis muscle | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 髂脛束 | Iliotibial tract | 筋膜相關 | 未分類 | 骨盆大腿、腿腳 | 2 | 補齊未分類 |
| 下孖肌 | Inferior gemellus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 外翼肌下頭 | Inferior head of lateral pterygoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 下斜肌（眼） | Inferior oblique muscle | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 下咽縮肌 | Inferior pharyngeal constrictor | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 下直肌（眼） | Inferior rectus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 棘下肌 | Infraspinatus muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 最內肋間肌 | Innermost intercostal muscles | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 腹內斜肌 | Internal abdominal oblique muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 肋間內肌 | Internal intercostal muscles | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 頸棘間肌 | Interspinales colli muscles | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 腰棘間肌 | Interspinales lumborum muscles | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 胸棘間肌 | Interspinales thoracis muscles | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 環杓側肌 | Lateral crico-arytenoid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 拇趾短屈肌外側頭 | Lateral head of flexor hallucis brevis | 肌肉 | 腿腳 | 腿腳 | 2 | 確認原分類 |
| 腓腸肌外側頭 | Lateral head of gastrocnemius | 肌肉 | 腿腳 | 腿腳 | 2 | 確認原分類 |
| 肱三頭肌外側頭 | Lateral head of triceps brachii | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 外直肌（眼） | Lateral rectus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 背闊肌 | Latissimus dorsi muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 提口角肌 | Levator anguli oris | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 提上唇肌 | Levator labii superioris | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 提上唇鼻翼肌 | Levator nasolabialis | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 提上瞼肌 | Levator palpebrae superioris | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 提肩胛肌 | Levator scapulae | 肌肉 | 未分類 | 頭頸、上臂肩部 | 2 | 補齊未分類 |
| 短肋提肌 | Levatores breves costarum | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 長肋提肌 | Levatores longi costarum | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 肱二頭肌長頭 | Long head of biceps brachii | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 股二頭肌長頭 | Long head of biceps femoris | 肌肉 | 骨盆大腿 | 骨盆大腿 | 2 | 確認原分類 |
| 肱三頭肌長頭 | Long head of triceps brachii | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 頭最長肌 | Longissimus capitis muscle | 肌肉 | 未分類 | 頭頸、脊胸腹 | 2 | 補齊未分類 |
| 頸最長肌 | Longissimus colli muscle | 肌肉 | 未分類 | 頭頸、脊胸腹 | 2 | 補齊未分類 |
| 胸最長肌 | Longissimus thoracis muscle | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 頭長肌 | Longus capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頸長肌 | Longus colli muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 足蚓狀肌 | Lumbrical muscles of foot | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 手蚓狀肌 | Lumbrical muscles of hand | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 拇趾短屈肌內側頭 | Medial head of flexor hallucis brevis | 肌肉 | 腿腳 | 腿腳 | 2 | 確認原分類 |
| 腓腸肌內側頭 | Medial head of gastrocnemius | 肌肉 | 腿腳 | 腿腳 | 2 | 確認原分類 |
| 肱三頭肌內側頭 | Medial head of triceps brachii | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 內翼肌 | Medial pterygoid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 內直肌（眼） | Medial rectus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頦肌 | Mentalis muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 中咽縮肌 | Middle pharyngeal constrictor | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頸多裂肌 | Multifidus colli muscle | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 腰多裂肌 | Multifidus lumborum muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 胸多裂肌 | Multifidus thoracis muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 下頷舌骨肌 | Mylohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 鼻肌 | Nasalis muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 拇趾內收肌斜頭 | Oblique head of adductor hallucis | 肌肉 | 骨盆大腿 | 腿腳 | 2 | 修正主分類 |
| 拇指內收肌斜頭 | Oblique head of adductor pollicis | 肌肉 | 骨盆大腿 | 前臂手部 | 2 | 修正主分類 |
| 環甲肌斜部 | Oblique part of cricothyroid muscle | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 頭下斜肌 | Obliquus inferior capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頭上斜肌 | Obliquus superior capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 閉孔外肌 | Obturator externus | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 閉孔內肌 | Obturator internus | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 枕肌 | Occipitalis muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 肩胛舌骨肌 | Omohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 手小指對掌肌 | Opponens digiti minimi muscle of hand | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 拇指對掌肌 | Opponens pollicis muscle | 肌肉 | 未分類 | 前臂手部 | 2 | 補齊未分類 |
| 口輪匝肌 | Orbicularis oris muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 眼輪匝肌眶部 | Orbital part of orbicularis oculi | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 顎咽肌 | Palatopharyngeus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 掌側骨間肌 | Palmar interossei muscles | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 掌長肌 | Palmaris longus muscle | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 眼輪匝肌瞼部 | Palpebral part of orbicularis oculi | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 恥骨肌 | Pectineus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 胸小肌 | Pectoralis minor muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 梨狀肌 | Piriformis muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 蹠側骨間肌 | Plantar interossei muscles | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 蹠肌 | Plantaris muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 闊頸肌 | Platysma | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 膕肌 | Popliteus muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 二腹肌後腹 | Posterior belly of digastric muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 環杓後肌 | Posterior crico-arytenoid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 鼻錐肌 | Procerus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 旋前方肌 | Pronator quadratus | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 腰大肌 | Psoas major | 肌肉 | 未分類 | 骨盆大腿、脊胸腹 | 2 | 補齊未分類 |
| 恥骨肛門肌 | Pubo-analis muscle | 肌肉 | 脊胸腹 | 骨盆大腿 | 2 | 修正主分類 |
| 恥骨尾骨肌 | Pubococcygeus muscle | 肌肉 | 脊胸腹 | 骨盆大腿 | 2 | 修正主分類 |
| 錐狀肌 | Pyramidalis muscle | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 股方肌 | Quadratus femoris muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 腰方肌 | Quadratus lumborum muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 足底方肌 | Quadratus plantae muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 淺屈指肌橈骨頭 | Radial head of flexor digitorum superficialis | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 腹直肌 | Rectus abdominis muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 頭前直肌 | Rectus anterior capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 股直肌 | Rectus femoris muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 頭外直肌 | Rectus lateralis capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頭後大直肌 | Rectus posterior major capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 頭後小直肌 | Rectus posterior minor capitis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 大菱形肌 | Rhomboid major muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 小菱形肌 | Rhomboid minor muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 笑肌 | Risorius muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 迴旋肌 | Rotatores | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 縫匠肌 | Sartorius muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 前斜角肌 | Scalenus anterior muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 中斜角肌 | Scalenus medius muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 後斜角肌 | Scalenus posterior muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 三角肌肩胛棘部 | Scapular spinal part of deltoid muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 半膜肌 | Semimembranosus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 頸半棘肌 | Semispinalis colli muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹 | 2 | 修正主分類 |
| 胸半棘肌 | Semispinalis thoracis muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 半腱肌 | Semitendinosus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 前鋸肌 | Serratus anterior muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 下後鋸肌 | Serratus posterior inferior muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 上後鋸肌 | Serratus posterior superior muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 橫突間肌 | set of anterior cervical intertransversarii | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 橫突間肌 | set of posterior cervical intertransversarii | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 肱二頭肌短頭 | Short head of biceps brachii | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 股二頭肌短頭 | Short head of biceps femoris | 肌肉 | 骨盆大腿 | 骨盆大腿 | 2 | 確認原分類 |
| 比目魚肌 | Soleus muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 頭棘肌 | Spinalis capitis muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹 | 2 | 修正主分類 |
| 頸棘肌 | Spinalis colli muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹 | 2 | 修正主分類 |
| 胸棘肌 | Spinalis thoracis muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 頭夾肌 | Splenius capitis muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹 | 2 | 修正主分類 |
| 頸夾肌 | Splenius colli muscle | 肌肉 | 脊胸腹 | 頭頸、脊胸腹 | 2 | 修正主分類 |
| 胸鎖乳突肌 | Sternocleidomastoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 胸大肌胸肋頭 | Sternocostal head of pectoralis major muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 胸骨舌骨肌 | Sternohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 胸骨甲狀肌 | Sternothyroid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 環甲肌直部 | Straight part of cricothyroid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 莖突舌骨肌 | Stylohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 莖突咽肌 | Stylopharyngeus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 鎖骨下肌 | Subclavius muscle | 肌肉 | 未分類 | 上臂肩部 | 2 | 補齊未分類 |
| 肩胛下肌 | Subscapularis muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 拇指短屈肌淺頭 | Superficial head of flexor pollicis brevis | 肌肉 | 頭頸 | 前臂手部 | 2 | 修正主分類 |
| 旋前圓肌淺頭 | Superficial head of pronator teres | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 咬肌淺部 | Superficial part of masseter | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 上孖肌 | Superior gemellus muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 外翼肌上頭 | Superior head of lateral pterygoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 上斜肌（眼） | Superior oblique muscle | 肌肉 | 脊胸腹 | 頭頸 | 2 | 修正主分類 |
| 上咽縮肌 | Superior pharyngeal constrictor | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 上直肌（眼） | Superior rectus muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 旋後肌 | Supinator | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 棘上肌 | Supraspinatus muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 手指滑液腱鞘 | Synovial sheaths of digits of hand | 筋膜相關 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 顳肌 | Temporalis muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 顳頂肌 | Temporoparietalis muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 闊筋膜張肌 | Tensor fasciae latae | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 大圓肌 | Teres major muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 小圓肌 | Teres minor muscle | 肌肉 | 上臂肩部 | 上臂肩部 | 2 | 確認原分類 |
| 甲杓肌甲會厭部 | Thyro-epiglottic part of thyro-arytenoid muscle | 肌肉 | 未分類 | 頭頸 | 2 | 補齊未分類 |
| 甲狀舌骨肌 | Thyrohyoid muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 脛前肌 | Tibialis anterior muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 脛後肌 | Tibialis posterior muscle | 肌肉 | 未分類 | 腿腳 | 2 | 補齊未分類 |
| 杓橫肌 | Transverse arytenoid muscle | 肌肉 | 未分類 | 頭頸 | 1 | 補齊未分類 |
| 拇趾內收肌橫頭 | Transverse head of adductor hallucis | 肌肉 | 骨盆大腿 | 腿腳 | 2 | 修正主分類 |
| 拇指內收肌橫頭 | Transverse head of adductor pollicis | 肌肉 | 骨盆大腿 | 前臂手部 | 2 | 修正主分類 |
| 斜方肌橫部 | Transverse part of trapezius muscle | 肌肉 | 脊胸腹 | 脊胸腹、上臂肩部 | 2 | 補充跨部位 |
| 腹橫肌 | Transversus abdominis muscle | 肌肉 | 脊胸腹 | 脊胸腹 | 2 | 確認原分類 |
| 胸橫肌 | Transversus thoracis muscle | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 尺側伸腕肌尺骨頭 | Ulnar head of extensor carpi ulnaris | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 尺側屈腕肌尺骨頭 | Ulnar head of flexor carpi ulnaris | 肌肉 | 前臂手部 | 前臂手部 | 2 | 確認原分類 |
| 股中間肌 | Vastus intermedius muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 股外側肌 | Vastus lateralis muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 股內側肌 | Vastus medialis muscle | 肌肉 | 未分類 | 骨盆大腿 | 2 | 補齊未分類 |
| 腰外側橫突間肌腹側部 | Ventral parts of lateral intertransversarii lumborum muscles | 肌肉 | 未分類 | 脊胸腹 | 2 | 補齊未分類 |
| 顴大肌 | Zygomaticus major muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |
| 顴小肌 | Zygomaticus minor muscle | 肌肉 | 頭頸 | 頭頸 | 2 | 確認原分類 |

## 排除範圍

| ID | 原英文資料 | 原顯示名稱 | 原因 |
| --- | --- | --- | --- |
| FJ2779 | thyrohyoid ligament | 甲狀舌骨肌 | 甲狀舌骨韌帶／膜，不列入肌筋膜系統 |
| FJ2790 | thyrohyoid ligament | 甲狀舌骨肌 | 甲狀舌骨韌帶／膜，不列入肌筋膜系統 |
| FJ2797 | thyrohyoid ligament | 甲狀舌骨肌 | 甲狀舌骨韌帶／膜，不列入肌筋膜系統 |
| FJ2786 | thyrohyoid membrane | 甲狀舌骨肌 | 甲狀舌骨韌帶／膜，不列入肌筋膜系統 |
| FJ2804 | thyrohyoid membrane | 甲狀舌骨肌 | 甲狀舌骨韌帶／膜，不列入肌筋膜系統 |

這些項目原本顯示成甲狀舌骨肌，但其英文資料是 ligament / membrane，與 Thyrohyoid muscle 的兩個真正肌肉網格分開處理；真正甲狀舌骨肌仍保留在頭頸。

## 來源與實作

部位整理參照 [OpenStax 頭頸與背部](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back)、[胸腹壁](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax)、[肩帶及上肢](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs)、[骨盆帶及下肢](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs)，筋膜相關結構另參照 [髂脛束](https://www.ncbi.nlm.nih.gov/books/NBK537097/) 與 [頭皮／帽狀腱膜](https://www.ncbi.nlm.nih.gov/books/NBK551565/)。六大部位及附分類為本專案按以上解剖區域整理的介面對照，不是直接複製任何來源的分類表。

frontend/scripts/anatomy-classification.mjs 是唯一的人工部位對照，沒有用中文包含頭、手、足等字眼做模糊分類。產生器將同一份結果寫入 GLB extras 與 Angular catalog；清單、三維顯示與爆炸圖使用相同 zones，避免看得到清單卻看不到模型。

tests/Anatomy.Checks/check-classification.mjs 驗證已知錯分案例、全部身份覆蓋、左右一致、跨部位與排除範圍；幾何驗證確認本次只改分類／範圍，保留網格頂點。
