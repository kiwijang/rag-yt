# trigger-point 與目前肌肉模型差異

分類直接讀取 trigger-point 的 zoneControls，肌肉歸屬直接讀取其 GLB Zone_* 階層，未分類保持未分類。原專案 GLB SHA-256：`c3b2f5dba02bbfb0f6768cb978422a020078162c0662edd39862cb4465749f76`。

## 數量與處理

- 參考模型：344 種結構名稱（234 肌肉／肌肉分部，110 非肌肉結構），左右側合計 687 個物件；排除 209 個文字／群組輔助 Mesh。
- 現有來源：492 個物件，包含原標示為肌肉的韌帶／膜／髂脛束；這些改標為支持結構，不算肌肉。
- 已有明確同義名稱對應：107 種；缺少 104 種，只有整組而缺獨立分部 23 種。
- 從參考 GLB 補入 253 個左右側／中線模型物件，並非僅新增名稱。現在 500 肌肉物件、238 骨骼、7 支持結構，共 745 個。
- 保留全部 492 個原模型物件與 FJ ID。25 個整組肌肉在已有細分模型時預設隱藏，可勾選顯示或直接選取；避免與細分部重疊。
- 參考來源的筋膜、滑囊、肌腱等非肌肉結構另列，未當作缺肌肉批次加入。

## 配準與限制

兩份來源的姿勢與幾何並不完全相同。以 176 個明確同名、同側肌肉的包圍盒中心計算單一中位平移：-0.000408, -0.065254, 0.101520 公尺，中位殘差 13.8 mm。新增網格僅套用原始世界矩陣與此平移，未雕塑、縮放或變更肌肉量；這是視覺配準，不是已驗證的醫學影像配準。每個錨點殘差、原始節點與完整對應可查資產 catalog.json。

參考來源中有些分類與直觀位置不同（例如拇指短屈肌分部在頭頸、部分足肌在前臂手部）；本次依使用者要求保留，不根據位置自動重分。未提供分類的新增骨骼及原來源額外肌肉顯示未分類。兩份來源都沒有可用皮膚或激痛點資料。

## 逐項對照

分類與覆蓋以名稱／分部為單位；物件數量則含左右側，兩者不可直接相減。整組覆蓋不視為獨立分部已存在。

| 中文名稱 | 參考名稱 | 參考分類 | 結果 | 原模型 FJ ID（或整組 ID） |
| --- | --- | --- | --- | --- |
| 胸大肌腹部 | (Abdominal part of pectoralis major muscle) | 脊胸腹 | 只有整組：已補獨立分部 | FJ1446M, FJ1446 |
| 小收肌 | (Adductor minimus) | 未分類 | 缺少：已補模型 | — |
| 髂恥滑囊 | (Iliopectineal bursa) | 未分類 | 非肌肉：未補入 | — |
| 足小趾對掌肌 | (Opponens digiti minimi muscle of foot) | 未分類 | 缺少：已補模型 | — |
| 足小趾外展肌 | Abductor digiti minimi of foot | 未分類 | 缺少：已補模型 | — |
| 手小指外展肌 | Abductor digiti minimi of hand | 前臂手部 | 缺少：已補模型 | — |
| 拇趾外展肌 | Abductor hallucis | 未分類 | 缺少：已補模型 | — |
| 拇指短外展肌 | Abductor pollicis brevis | 未分類 | 缺少：已補模型 | — |
| 拇指長外展肌 | Abductor pollicis longus | 未分類 | 缺少：已補模型 | — |
| 三角肌肩峰部 | Acromial part of deltoid muscle | 上臂肩部 | 已有對應 | FJ1467M, FJ1467 |
| 短收肌 | Adductor brevis | 未分類 | 已有對應 | FJ1401M, FJ1401 |
| 長收肌 | Adductor longus | 未分類 | 已有對應 | FJ1402M, FJ1402 |
| 大收肌 | Adductor magnus | 未分類 | 已有對應 | FJ1403M, FJ1403 |
| 肘肌 | Anconeus muscle | 前臂手部 | 已有對應 | FJ1485M, FJ1485 |
| 鵝足滑囊 | Anserine bursa | 未分類 | 非肌肉：未補入 | — |
| 前臂筋膜 | Antebrachial fascia | 前臂手部 | 非肌肉：未補入 | — |
| 二腹肌前腹 | Anterior belly of digastric muscle | 頭頸 | 只有整組：已補獨立分部 | FJ1555, FJ1556, FJ1560, FJ1578, FJ1579 |
| 小腿前肌間隔 | Anterior intermuscular septum of leg | 腿腳 | 非肌肉：未補入 | — |
| 胸腰筋膜前層 | Anterior layer of thoracolumbar fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 杓斜肌杓會厭部 | Ary-epiglottic part of oblique arytenoid muscle | 脊胸腹 | 缺少：已補模型 | — |
| 斜方肌升部 | Ascending part of trapezius muscle | 脊胸腹 | 已有對應 | FJ1520M, FJ1520 |
| 肱二頭肌橈骨滑囊 | Bicipitoradial bursa | 未分類 | 非肌肉：未補入 | — |
| 臂筋膜 | Brachial fascia | 未分類 | 非肌肉：未補入 | — |
| 肱肌 | Brachialis muscle | 上臂肩部 | 已有對應 | FJ1486M, FJ1486 |
| 肱橈肌 | Brachioradialis muscle | 前臂手部 | 已有對應 | FJ1487M, FJ1487 |
| 頰肌 | Bucinator | 未分類 | 缺少：已補模型 | — |
| 梨狀肌滑囊 | Bursa of piriformis muscle | 未分類 | 非肌肉：未補入 | — |
| 跟腱（阿基里斯腱） | Calcaneal tendon | 未分類 | 非肌肉：未補入 | — |
| 胸大肌鎖骨頭 | Clavicular head of pectoralis major muscle | 脊胸腹 | 已有對應 | FJ1447M, FJ1447 |
| 三角肌鎖骨部 | Clavicular part of deltoid muscle | 上臂肩部 | 已有對應 | FJ1468M, FJ1468 |
| 鎖胸筋膜 | Clavipectoral fascia | 未分類 | 非肌肉：未補入 | — |
| 尾骨肌 | Coccygeus muscle | 脊胸腹 | 缺少：已補模型 | — |
| 屈肌總腱鞘 | Common flexor tendon sheath | 未分類 | 非肌肉：未補入 | — |
| 總腱環 | Common tendinous ring | 未分類 | 非肌肉：未補入 | — |
| 腓骨肌總腱鞘 | Common tendon sheath of fibularis muscles | 未分類 | 非肌肉：未補入 | — |
| 喙肱肌滑囊 | Coracobrachial bursa | 未分類 | 非肌肉：未補入 | — |
| 喙肱肌 | Coracobrachialis muscle | 上臂肩部 | 已有對應 | FJ1488M, FJ1488 |
| 皺眉肌 | Corrugator supercilii | 未分類 | 缺少：已補模型 | — |
| 手指纖維鞘交叉部 | Cruciform part of fibrous sheath of digit of hand | 前臂手部 | 缺少：已補模型 | — |
| 小腿筋膜 | Crural fascia | 未分類 | 非肌肉：未補入 | — |
| 拇指短屈肌深頭 | Deep head of flexor pollicis brevis | 頭頸 | 缺少：已補模型 | — |
| 旋前圓肌深頭 | Deep head of pronator teres | 前臂手部 | 只有整組：已補獨立分部 | FJ1474M, FJ1474 |
| 深髕下滑囊 | Deep infrapatellar bursa | 未分類 | 非肌肉：未補入 | — |
| 咬肌深部 | Deep part of masseter | 頭頸 | 缺少：已補模型 | — |
| 三角肌筋膜 | Deltoid fascia | 上臂肩部 | 非肌肉：未補入 | — |
| 降口角肌 | Depressor anguli oris | 未分類 | 缺少：已補模型 | — |
| 降下唇肌 | Depressor labii inferioris | 未分類 | 缺少：已補模型 | — |
| 降鼻中隔肌 | Depressor septi nasi | 未分類 | 缺少：已補模型 | — |
| 斜方肌降部 | Descending part of trapezius muscle | 脊胸腹 | 已有對應 | FJ1521M, FJ1521 |
| 橫膈肌 | Diaphragm | 脊胸腹 | 已有對應 | FJ3131 |
| 橫膈筋膜 | Diaphragmatic fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 手背筋膜 | Dorsal fascia of hand | 前臂手部 | 非肌肉：未補入 | — |
| 足背側骨間肌 | Dorsal interossei muscles of foot | 未分類 | 缺少：已補模型 | — |
| 手背側骨間肌 | Dorsal interossei muscles of hand | 前臂手部 | 缺少：已補模型 | — |
| 腰外側橫突間肌背側部 | Dorsal parts of lateral intertransversarii lumborum muscles | 未分類 | 缺少：已補模型 | — |
| 帽狀腱膜 | Epicranial aponeurosis | 頭頸 | 非肌肉：未補入 | — |
| 橈側伸腕短肌 | Extensor carpi radialis brevis | 前臂手部 | 已有對應 | FJ1489M, FJ1489 |
| 橈側伸腕長肌 | Extensor carpi radialis longus | 前臂手部 | 已有對應 | FJ1490M, FJ1490 |
| 小指伸肌 | Extensor digiti minimi | 前臂手部 | 缺少：已補模型 | — |
| 伸指肌 | Extensor digitorum | 前臂手部 | 已有對應 | FJ1492M, FJ1492 |
| 趾短伸肌 | Extensor digitorum brevis | 前臂手部 | 已有對應 | FJ1407M, FJ1407 |
| 趾長伸肌 | Extensor digitorum longus | 腿腳 | 已有對應 | FJ1406M, FJ1406 |
| 拇趾短伸肌 | Extensor hallucis brevis | 未分類 | 缺少：已補模型 | — |
| 拇趾長伸肌 | Extensor hallucis longus | 未分類 | 已有對應 | FJ1408M, FJ1408 |
| 食指伸肌 | Extensor indicis | 未分類 | 缺少：已補模型 | — |
| 拇指短伸肌 | Extensor pollicis brevis | 未分類 | 缺少：已補模型 | — |
| 拇指長伸肌 | Extensor pollicis longus | 未分類 | 缺少：已補模型 | — |
| 腕伸肌支持帶 | Extensor retinaculum of wrist | 前臂手部 | 非肌肉：未補入 | — |
| 腹外斜肌 | External abdominal oblique muscle | 脊胸腹 | 已有對應 | FJ1452M, FJ1452 |
| 肛門外括約肌 | External anal sphincter | 未分類 | 缺少：已補模型 | — |
| 肋間外肌 | External intercostal muscles | 脊胸腹 | 已有對應 | FJ1451M, FJ1451 |
| 甲杓肌外側部 | External part of thyro-arytenoid muscle | 未分類 | 缺少：已補模型 | — |
| 闊筋膜 | Fascia lata | 未分類 | 非肌肉：未補入 | — |
| 腓骨短肌 | Fibularis brevis muscle | 未分類 | 已有對應 | FJ1409M, FJ1409 |
| 腓骨長肌 | Fibularis longus muscle | 未分類 | 已有對應 | FJ1410M, FJ1410 |
| 第三腓骨肌 | Fibularis tertius muscle | 未分類 | 缺少：已補模型 | — |
| 橈側屈腕肌 | Flexor carpi radialis | 前臂手部 | 已有對應 | FJ1496M, FJ1496 |
| 足小趾短屈肌 | Flexor digiti minimi of foot | 未分類 | 缺少：已補模型 | — |
| 手小指短屈肌 | Flexor digiti minimi of hand | 前臂手部 | 缺少：已補模型 | — |
| 趾短屈肌 | Flexor digitorum brevis | 未分類 | 缺少：已補模型 | — |
| 趾長屈肌 | Flexor digitorum longus | 未分類 | 已有對應 | FJ1414M, FJ1414 |
| 深屈指肌 | Flexor digitorum profundus | 前臂手部 | 已有對應 | FJ1497M, FJ1497 |
| 拇趾長屈肌 | Flexor hallucis longus | 未分類 | 已有對應 | FJ1415M, FJ1415 |
| 拇指長屈肌 | Flexor pollicis longus | 未分類 | 缺少：已補模型 | — |
| 踝屈肌支持帶 | Flexor retinaculum of ankle | 腿腳 | 非肌肉：未補入 | — |
| 腕屈肌支持帶 | Flexor retinaculum of wrist | 前臂手部 | 非肌肉：未補入 | — |
| 額肌 | Frontalis muscle | 頭頸 | 缺少：已補模型 | — |
| 頦舌肌 | Genioglossus muscle | 未分類 | 缺少：已補模型 | — |
| 頦舌骨肌 | Geniohyoid muscle | 頭頸 | 已有對應 | FJ1559, FJ1580 |
| 臀大肌 | Gluteus maximus muscle | 未分類 | 已有對應 | FJ1418M, FJ1418 |
| 臀中肌 | Gluteus medius muscle | 未分類 | 已有對應 | FJ1419M, FJ1419 |
| 臀小肌 | Gluteus minimus muscle | 未分類 | 已有對應 | FJ1420M, FJ1420 |
| 股薄肌 | Gracilis muscle | 未分類 | 已有對應 | FJ1421M, FJ1421 |
| 尺側伸腕肌肱骨頭 | Humeral head of extensor carpi ulnaris | 前臂手部 | 只有整組：已補獨立分部 | FJ1472M, FJ1472 |
| 尺側屈腕肌肱骨頭 | Humeral head of flexor carpi ulnaris | 前臂手部 | 只有整組：已補獨立分部 | FJ1498M, FJ1498 |
| 淺屈指肌肱尺頭 | Humero-ulnar head of flexor digitorum superficialis | 前臂手部 | 只有整組：已補獨立分部 | FJ1475M, FJ1475 |
| 舌骨舌肌 | Hyoglossus muscle | 未分類 | 缺少：已補模型 | — |
| 髂肌 | Iliacus muscle | 未分類 | 已有對應 | FJ1422M, FJ1422 |
| 髂尾肌 | Iliococcygeus muscle | 脊胸腹 | 缺少：已補模型 | — |
| 頸髂肋肌 | Iliocostalis colli muscle | 未分類 | 已有對應 | FJ1526, FJ1526M |
| 腰髂肋肌 | Iliocostalis lumborum muscle | 未分類 | 已有對應 | FJ1527, FJ1527M |
| 胸髂肋肌 | Iliocostalis thoracis muscle | 未分類 | 已有對應 | FJ1528, FJ1528M |
| 髂恥弓 | Iliopectineal arch | 未分類 | 非肌肉：未補入 | — |
| 髂腰筋膜 | Iliopsoas fascia | 骨盆大腿 | 非肌肉：未補入 | — |
| 髂脛束 | Iliotibial tract | 未分類 | 已有對應 | FJ1423, FJ1423M |
| 踝下伸肌支持帶 | Inferior extensor retinaculum of ankle | 腿腳 | 非肌肉：未補入 | — |
| 下腓骨肌支持帶 | Inferior fibular retinaculum | 未分類 | 非肌肉：未補入 | — |
| 下孖肌 | Inferior gemellus muscle | 未分類 | 缺少：已補模型 | — |
| 外翼肌下頭 | Inferior head of lateral pterygoid muscle | 頭頸 | 缺少：已補模型 | — |
| 下斜肌（眼） | Inferior oblique muscle | 脊胸腹 | 已有對應 | FJ1294, FJ1345 |
| 下咽縮肌 | Inferior pharyngeal constrictor | 未分類 | 缺少：已補模型 | — |
| 下直肌（眼） | Inferior rectus muscle | 未分類 | 已有對應 | FJ1295, FJ1346 |
| 股二頭肌下腱下滑囊 | Inferior subtendinous bursa of biceps femoris muscle | 未分類 | 非肌肉：未補入 | — |
| 下瞼板 | Inferior tarsus | 未分類 | 非肌肉：未補入 | — |
| 棘下肌 | Infraspinatus muscle | 上臂肩部 | 已有對應 | FJ1500M, FJ1500 |
| 腹股溝韌帶 | Inguinal ligament | 未分類 | 非肌肉：未補入 | — |
| 最內肋間肌 | Innermost intercostal muscles | 脊胸腹 | 缺少：已補模型 | — |
| 二腹肌中間腱 | Intermediate tendon of digastric muscle | 頭頸 | 非肌肉：未補入 | — |
| 臀肌間滑囊 | Intermuscular gluteal bursae | 未分類 | 非肌肉：未補入 | — |
| 腹內斜肌 | Internal abdominal oblique muscle | 脊胸腹 | 已有對應 | FJ1453M |
| 肋間內肌 | Internal intercostal muscles | 脊胸腹 | 已有對應 | FJ1455M, FJ1455 |
| 頸棘間肌 | Interspinales colli muscles | 脊胸腹 | 已有對應 | FJ1552, FJ1552M |
| 腰棘間肌 | Interspinales lumborum muscles | 脊胸腹 | 已有對應 | FJ1550, FJ1550M |
| 胸棘間肌 | Interspinales thoracis muscles | 脊胸腹 | 缺少：已補模型 | — |
| 結節間腱鞘 | Intertubercular tendon sheath | 未分類 | 非肌肉：未補入 | — |
| 腹部包被筋膜 | Investing abdominal fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 環杓側肌 | Lateral crico-arytenoid muscle | 未分類 | 缺少：已補模型 | — |
| 股外側肌間隔 | Lateral femoral intermuscular septum | 未分類 | 非肌肉：未補入 | — |
| 拇趾短屈肌外側頭 | Lateral head of flexor hallucis brevis | 腿腳 | 只有整組：已補獨立分部 | FJ1416M, FJ1416 |
| 腓腸肌外側頭 | Lateral head of gastrocnemius | 腿腳 | 已有對應 | FJ1394M, FJ1394 |
| 肱三頭肌外側頭 | Lateral head of triceps brachii | 上臂肩部 | 已有對應 | FJ1477M, FJ1477 |
| 臂外側肌間隔 | Lateral intermuscular septum of arm | 上臂肩部 | 非肌肉：未補入 | — |
| 髕外側支持帶 | Lateral patellar retinaculum | 未分類 | 非肌肉：未補入 | — |
| 外直肌（眼） | Lateral rectus muscle | 未分類 | 已有對應 | FJ1304, FJ1355 |
| 腓腸肌外側腱下滑囊 | Lateral subtendinous bursa of gastrocnemius muscle | 未分類 | 非肌肉：未補入 | — |
| 背闊肌 | Latissimus dorsi muscle | 脊胸腹 | 已有對應 | FJ_LAT_L, FJ_LAT_R |
| 提口角肌 | Levator anguli oris | 未分類 | 缺少：已補模型 | — |
| 提上唇肌 | Levator labii superioris | 未分類 | 缺少：已補模型 | — |
| 提上唇鼻翼肌 | Levator nasolabialis | 未分類 | 缺少：已補模型 | — |
| 提上瞼肌 | Levator palpebrae superioris | 未分類 | 已有對應 | FJ1306, FJ1357 |
| 提肩胛肌 | Levator scapulae | 未分類 | 已有對應 | FJ1532M, FJ1532 |
| 短肋提肌 | Levatores breves costarum | 未分類 | 缺少：已補模型 | — |
| 長肋提肌 | Levatores longi costarum | 未分類 | 已有對應 | FJ1463M, FJ1463 |
| 腹白線 | Linea alba | 未分類 | 非肌肉：未補入 | — |
| 肱二頭肌長頭 | Long head of biceps brachii | 上臂肩部 | 已有對應 | FJ1478M, FJ1478 |
| 股二頭肌長頭 | Long head of biceps femoris | 骨盆大腿 | 已有對應 | FJ1411M, FJ1411 |
| 肱三頭肌長頭 | Long head of triceps brachii | 上臂肩部 | 已有對應 | FJ1479M, FJ1479 |
| 頭最長肌 | Longissimus capitis muscle | 未分類 | 已有對應 | FJ1533, FJ1533M |
| 頸最長肌 | Longissimus colli muscle | 未分類 | 已有對應 | FJ1534, FJ1534M |
| 胸最長肌 | Longissimus thoracis muscle | 未分類 | 已有對應 | FJ1535, FJ1535M |
| 頭長肌 | Longus capitis muscle | 未分類 | 缺少：已補模型 | — |
| 頸長肌 | Longus colli muscle | 未分類 | 缺少：已補模型 | — |
| 足蚓狀肌 | Lumbrical muscles of foot | 未分類 | 缺少：已補模型 | — |
| 手蚓狀肌 | Lumbrical muscles of hand | 前臂手部 | 缺少：已補模型 | — |
| 咬肌筋膜 | Masseteric fascia | 頭頸 | 非肌肉：未補入 | — |
| 股內側肌間隔 | Medial femoral intermuscular septum | 未分類 | 非肌肉：未補入 | — |
| 拇趾短屈肌內側頭 | Medial head of flexor hallucis brevis | 腿腳 | 只有整組：已補獨立分部 | FJ1416M, FJ1416 |
| 腓腸肌內側頭 | Medial head of gastrocnemius | 腿腳 | 已有對應 | FJ1397M, FJ1397 |
| 肱三頭肌內側頭 | Medial head of triceps brachii | 上臂肩部 | 已有對應 | FJ1480M, FJ1480 |
| 臂內側肌間隔 | Medial intermuscular septum of arm | 上臂肩部 | 非肌肉：未補入 | — |
| 髕內側支持帶 | Medial patellar retinaculum | 未分類 | 非肌肉：未補入 | — |
| 內翼肌 | Medial pterygoid muscle | 未分類 | 缺少：已補模型 | — |
| 內直肌（眼） | Medial rectus muscle | 未分類 | 已有對應 | FJ1308, FJ1359 |
| 腓腸肌內側腱下滑囊 | Medial subtendinous bursa of gastrocnemius muscle | 未分類 | 非肌肉：未補入 | — |
| 頦肌 | Mentalis muscle | 頭頸 | 缺少：已補模型 | — |
| 胸腰筋膜中層 | Middle layer of thoracolumbar fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 中咽縮肌 | Middle pharyngeal constrictor | 未分類 | 缺少：已補模型 | — |
| 頸多裂肌 | Multifidus colli muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1541M, FJ1541 |
| 腰多裂肌 | Multifidus lumborum muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1541M, FJ1541 |
| 胸多裂肌 | Multifidus thoracis muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1541M, FJ1541 |
| 下頷舌骨肌 | Mylohyoid muscle | 頭頸 | 已有對應 | FJ1562, FJ1583 |
| 鼻肌 | Nasalis muscle | 頭頸 | 缺少：已補模型 | — |
| 拇趾內收肌斜頭 | Oblique head of adductor hallucis | 骨盆大腿 | 缺少：已補模型 | — |
| 拇指內收肌斜頭 | Oblique head of adductor pollicis | 骨盆大腿 | 缺少：已補模型 | — |
| 環甲肌斜部 | Oblique part of cricothyroid muscle | 脊胸腹 | 缺少：已補模型 | — |
| 頭下斜肌 | Obliquus inferior capitis muscle | 未分類 | 缺少：已補模型 | — |
| 頭上斜肌 | Obliquus superior capitis muscle | 未分類 | 缺少：已補模型 | — |
| 閉孔外肌 | Obturator externus | 未分類 | 已有對應 | FJ1425M, FJ1425 |
| 閉孔內肌 | Obturator internus | 未分類 | 已有對應 | FJ1426M, FJ1426 |
| 枕肌 | Occipitalis muscle | 頭頸 | 缺少：已補模型 | — |
| 肩胛舌骨肌 | Omohyoid muscle | 頭頸 | 已有對應 | FJ1565, FJ1586 |
| 手小指對掌肌 | Opponens digiti minimi muscle of hand | 前臂手部 | 缺少：已補模型 | — |
| 拇指對掌肌 | Opponens pollicis muscle | 未分類 | 缺少：已補模型 | — |
| 口輪匝肌 | Orbicularis oris muscle | 頭頸 | 缺少：已補模型 | — |
| 眼輪匝肌眶部 | Orbital part of orbicularis oculi | 頭頸 | 缺少：已補模型 | — |
| 顎咽肌 | Palatopharyngeus muscle | 未分類 | 缺少：已補模型 | — |
| 掌腱膜 | Palmar aponeurosis | 前臂手部 | 非肌肉：未補入 | — |
| 掌側骨間肌 | Palmar interossei muscles | 前臂手部 | 缺少：已補模型 | — |
| 掌長肌 | Palmaris longus muscle | 前臂手部 | 已有對應 | FJ1502M, FJ1502 |
| 眼輪匝肌瞼部 | Palpebral part of orbicularis oculi | 頭頸 | 缺少：已補模型 | — |
| 恥骨肌 | Pectineus muscle | 未分類 | 已有對應 | FJ1427, FJ1427M |
| 胸肌筋膜 | Pectoral fascia | 未分類 | 非肌肉：未補入 | — |
| 胸小肌 | Pectoralis minor muscle | 脊胸腹 | 已有對應 | FJ1456M, FJ1456 |
| 梨狀肌筋膜 | Piriformis fascia | 未分類 | 非肌肉：未補入 | — |
| 梨狀肌 | Piriformis muscle | 未分類 | 已有對應 | FJ1428M, FJ1428 |
| 足底腱膜 | Plantar aponeurosis | 腿腳 | 非肌肉：未補入 | — |
| 蹠側骨間肌 | Plantar interossei muscles | 未分類 | 缺少：已補模型 | — |
| 腓骨長肌足底腱鞘 | Plantar tendon sheath of fibularis longus muscle | 未分類 | 非肌肉：未補入 | — |
| 蹠肌 | Plantaris muscle | 未分類 | 已有對應 | FJ1429M, FJ1429 |
| 闊頸肌 | Platysma | 頭頸 | 已有對應 | FJ1558, FJ1587 |
| 膕筋膜 | Popliteal fascia | 未分類 | 非肌肉：未補入 | — |
| 膕肌 | Popliteus muscle | 未分類 | 已有對應 | FJ1430M, FJ1430 |
| 二腹肌後腹 | Posterior belly of digastric muscle | 頭頸 | 只有整組：已補獨立分部 | FJ1555, FJ1556, FJ1560, FJ1578, FJ1579 |
| 環杓後肌 | Posterior crico-arytenoid muscle | 未分類 | 缺少：已補模型 | — |
| 小腿後肌間隔 | Posterior intermuscular septum of leg | 腿腳 | 非肌肉：未補入 | — |
| 胸腰筋膜後層 | Posterior layer of thoracolumbar fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 鼻錐肌 | Procerus muscle | 未分類 | 缺少：已補模型 | — |
| 旋前方肌 | Pronator quadratus | 前臂手部 | 已有對應 | FJ1503M, FJ1503 |
| 腰大肌 | Psoas major | 未分類 | 已有對應 | FJ1431M, FJ1431 |
| 恥骨肛門肌 | Pubo-analis muscle | 脊胸腹 | 缺少：已補模型 | — |
| 恥骨尾骨肌 | Pubococcygeus muscle | 脊胸腹 | 缺少：已補模型 | — |
| 錐狀肌 | Pyramidalis muscle | 未分類 | 缺少：已補模型 | — |
| 股方肌 | Quadratus femoris muscle | 未分類 | 已有對應 | FJ1432M, FJ1432 |
| 腰方肌 | Quadratus lumborum muscle | 脊胸腹 | 已有對應 | FJ1540M, FJ1540 |
| 足底方肌 | Quadratus plantae muscle | 未分類 | 缺少：已補模型 | — |
| 淺屈指肌橈骨頭 | Radial head of flexor digitorum superficialis | 前臂手部 | 只有整組：已補獨立分部 | FJ1475M, FJ1475 |
| 腹直肌 | Rectus abdominis muscle | 脊胸腹 | 已有對應 | FJ1460M, FJ1460 |
| 頭前直肌 | Rectus anterior capitis muscle | 未分類 | 缺少：已補模型 | — |
| 股直肌 | Rectus femoris muscle | 未分類 | 已有對應 | FJ1433M, FJ1433 |
| 頭外直肌 | Rectus lateralis capitis muscle | 未分類 | 缺少：已補模型 | — |
| 頭後大直肌 | Rectus posterior major capitis muscle | 未分類 | 缺少：已補模型 | — |
| 頭後小直肌 | Rectus posterior minor capitis muscle | 未分類 | 缺少：已補模型 | — |
| 大菱形肌 | Rhomboid major muscle | 脊胸腹 | 已有對應 | FJ1536M, FJ1536 |
| 小菱形肌 | Rhomboid minor muscle | 脊胸腹 | 已有對應 | FJ1537M, FJ1537 |
| 笑肌 | Risorius muscle | 未分類 | 缺少：已補模型 | — |
| 迴旋肌 | Rotatores | 脊胸腹 | 缺少：已補模型 | — |
| 縫匠肌 | Sartorius muscle | 未分類 | 已有對應 | FJ1434M, FJ1434 |
| 前斜角肌 | Scalenus anterior muscle | 頭頸 | 只有整組：已補獨立分部 | FJ1543M, FJ1543 |
| 中斜角肌 | Scalenus medius muscle | 頭頸 | 只有整組：已補獨立分部 | FJ1543M, FJ1543 |
| 後斜角肌 | Scalenus posterior muscle | 頭頸 | 只有整組：已補獨立分部 | FJ1543M, FJ1543 |
| 三角肌肩胛棘部 | Scapular spinal part of deltoid muscle | 上臂肩部 | 已有對應 | FJ1513M, FJ1513 |
| 臀大肌坐骨滑囊 | Sciatic bursa of gluteus maximus muscle | 未分類 | 非肌肉：未補入 | — |
| 閉孔內肌坐骨滑囊 | Sciatic bursa of obturator internus | 未分類 | 非肌肉：未補入 | — |
| 半膜肌滑囊 | Semimembranosus bursa | 未分類 | 非肌肉：未補入 | — |
| 半膜肌 | Semimembranosus muscle | 未分類 | 已有對應 | FJ1435M, FJ1435 |
| 頸半棘肌 | Semispinalis colli muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1538M, FJ1538 |
| 胸半棘肌 | Semispinalis thoracis muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1538M, FJ1538 |
| 半腱肌 | Semitendinosus muscle | 未分類 | 已有對應 | FJ1436M, FJ1436 |
| 前鋸肌 | Serratus anterior muscle | 脊胸腹 | 已有對應 | FJ1459M, FJ1459 |
| 下後鋸肌 | Serratus posterior inferior muscle | 脊胸腹 | 缺少：已補模型 | — |
| 上後鋸肌 | Serratus posterior superior muscle | 脊胸腹 | 缺少：已補模型 | — |
| 肱二頭肌短頭 | Short head of biceps brachii | 上臂肩部 | 已有對應 | FJ1512M, FJ1512 |
| 股二頭肌短頭 | Short head of biceps femoris | 骨盆大腿 | 已有對應 | FJ1444M, FJ1444 |
| 比目魚肌 | Soleus muscle | 未分類 | 已有對應 | FJ1437M, FJ1437 |
| 頭棘肌 | Spinalis capitis muscle | 脊胸腹 | 缺少：已補模型 | — |
| 頸棘肌 | Spinalis colli muscle | 脊胸腹 | 缺少：已補模型 | — |
| 胸棘肌 | Spinalis thoracis muscle | 脊胸腹 | 已有對應 | FJ1544, FJ1544M |
| 頭夾肌 | Splenius capitis muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1542M, FJ1542 |
| 頸夾肌 | Splenius colli muscle | 脊胸腹 | 只有整組：已補獨立分部 | FJ1542M, FJ1542 |
| 胸鎖乳突肌 | Sternocleidomastoid muscle | 頭頸 | 已有對應 | FJ1591, FJ1569 |
| 胸大肌胸肋頭 | Sternocostal head of pectoralis major muscle | 脊胸腹 | 已有對應 | FJ1464M, FJ1464 |
| 胸骨舌骨肌 | Sternohyoid muscle | 頭頸 | 已有對應 | FJ1574, FJ1596 |
| 胸骨甲狀肌 | Sternothyroid muscle | 未分類 | 已有對應 | FJ1575, FJ1597 |
| 環甲肌直部 | Straight part of cricothyroid muscle | 未分類 | 缺少：已補模型 | — |
| 莖突舌骨肌 | Stylohyoid muscle | 頭頸 | 缺少：已補模型 | — |
| 莖突咽肌 | Stylopharyngeus muscle | 未分類 | 缺少：已補模型 | — |
| 肩峰下滑囊 | Subacromial bursa | 未分類 | 非肌肉：未補入 | — |
| 鎖骨下肌 | Subclavius muscle | 未分類 | 缺少：已補模型 | — |
| 肩峰皮下滑囊 | Subcutaneous acromial bursa | 未分類 | 非肌肉：未補入 | — |
| 外踝皮下滑囊 | Subcutaneous bursa of lateral malleolus | 未分類 | 非肌肉：未補入 | — |
| 內踝皮下滑囊 | Subcutaneous bursa of medial malleolus | 未分類 | 非肌肉：未補入 | — |
| 脛骨粗隆皮下滑囊 | Subcutaneous bursa of tuberosity of tibia | 未分類 | 非肌肉：未補入 | — |
| 跟部皮下滑囊 | Subcutaneous calcaneal bursa | 未分類 | 非肌肉：未補入 | — |
| 髕下皮下滑囊 | Subcutaneous infrapatellar bursa | 未分類 | 非肌肉：未補入 | — |
| 髕前皮下滑囊 | Subcutaneous prepatellar bursa | 未分類 | 非肌肉：未補入 | — |
| 轉子部皮下滑囊 | Subcutaneous trochanteric bursa | 未分類 | 非肌肉：未補入 | — |
| 三角肌下滑囊 | Subdeltoid bursa | 未分類 | 非肌肉：未補入 | — |
| 髕前筋膜下滑囊 | Subfacial prepatellar bursa | 腿腳 | 非肌肉：未補入 | — |
| 肩胛下肌 | Subscapularis muscle | 上臂肩部 | 已有對應 | FJ1504M, FJ1504 |
| 髂肌腱下滑囊 | Subtendinous bursa of iliacus muscle | 未分類 | 非肌肉：未補入 | — |
| 棘下肌腱下滑囊 | Subtendinous bursa of infraspinatus muscle | 未分類 | 非肌肉：未補入 | — |
| 閉孔內肌腱下滑囊 | Subtendinous bursa of obturator internus | 未分類 | 非肌肉：未補入 | — |
| 縫匠肌腱下滑囊 | Subtendinous bursa of sartorius muscle | 未分類 | 非肌肉：未補入 | — |
| 大圓肌腱下滑囊 | Subtendinous bursa of teres major muscle | 未分類 | 非肌肉：未補入 | — |
| 脛前肌腱下滑囊 | Subtendinous bursa of tibialis anterior | 未分類 | 非肌肉：未補入 | — |
| 斜方肌腱下滑囊 | Subtendinous bursa of trapezius muscle | 未分類 | 非肌肉：未補入 | — |
| 肱三頭肌腱下滑囊 | Subtendinous bursa of triceps brachii muscle | 未分類 | 非肌肉：未補入 | — |
| 跟腱下滑囊 | Subtendinous calcaneal bursa | 未分類 | 非肌肉：未補入 | — |
| 髕前腱下滑囊 | Subtendinous prepatellar bursa | 未分類 | 非肌肉：未補入 | — |
| 拇指短屈肌淺頭 | Superficial head of flexor pollicis brevis | 頭頸 | 缺少：已補模型 | — |
| 旋前圓肌淺頭 | Superficial head of pronator teres | 前臂手部 | 只有整組：已補獨立分部 | FJ1474M, FJ1474 |
| 頸包被筋膜淺層 | Superficial investing cervical fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 顳筋膜淺層 | Superficial layer of temporal fascia | 頭頸 | 非肌肉：未補入 | — |
| 咬肌淺部 | Superficial part of masseter | 頭頸 | 缺少：已補模型 | — |
| 掌骨淺橫韌帶 | Superficial transverse metacarpal ligament | 前臂手部 | 非肌肉：未補入 | — |
| 蹠骨淺橫韌帶 | Superficial transverse metatarsal ligament | 腿腳 | 非肌肉：未補入 | — |
| 股二頭肌上滑囊 | Superior bursa of biceps femoris muscle | 未分類 | 非肌肉：未補入 | — |
| 踝上伸肌支持帶 | Superior extensor retinaculum of ankle | 腿腳 | 非肌肉：未補入 | — |
| 上腓骨肌支持帶 | Superior fibular retinaculum | 未分類 | 非肌肉：未補入 | — |
| 上孖肌 | Superior gemellus muscle | 未分類 | 已有對應 | FJ1417, FJ1417M |
| 外翼肌上頭 | Superior head of lateral pterygoid muscle | 頭頸 | 缺少：已補模型 | — |
| 上斜肌（眼） | Superior oblique muscle | 脊胸腹 | 已有對應 | FJ1322, FJ1373 |
| 上咽縮肌 | Superior pharyngeal constrictor | 未分類 | 缺少：已補模型 | — |
| 上直肌（眼） | Superior rectus muscle | 未分類 | 已有對應 | FJ1323, FJ1374 |
| 上瞼板 | Superior tarsus | 未分類 | 非肌肉：未補入 | — |
| 旋後肌 | Supinator | 前臂手部 | 已有對應 | FJ1505M, FJ1505 |
| 髕上滑囊 | Suprapatellar bursa | 未分類 | 非肌肉：未補入 | — |
| 棘上肌 | Supraspinatus muscle | 上臂肩部 | 已有對應 | FJ1506M, FJ1506 |
| 手指滑液腱鞘 | Synovial sheaths of digits of hand | 前臂手部 | 缺少：已補模型 | — |
| 顳肌 | Temporalis muscle | 頭頸 | 缺少：已補模型 | — |
| 顳頂肌 | Temporoparietalis muscle | 未分類 | 缺少：已補模型 | — |
| 提肛肌腱弓 | Tendinous arch of levator ani | 脊胸腹 | 非肌肉：未補入 | — |
| 趾長伸肌腱 | Tendon of extensor digitorum longus | 腿腳 | 非肌肉：未補入 | — |
| 拇指長外展肌與拇指短伸肌腱鞘 | Tendon sheath - abd. pollicis longus - ext. pollicis brevis | 前臂手部 | 非肌肉：未補入 | — |
| 尺側伸腕肌腱鞘 | Tendon sheath of extensor carpi ulnaris | 前臂手部 | 非肌肉：未補入 | — |
| 小指伸肌腱鞘 | Tendon sheath of extensor digiti minimi manus | 前臂手部 | 非肌肉：未補入 | — |
| 伸指肌與食指伸肌腱鞘 | Tendon sheath of extensor digitorum and extensor indicis | 前臂手部 | 非肌肉：未補入 | — |
| 趾長伸肌腱鞘 | Tendon sheath of extensor digitorum longus | 腿腳 | 非肌肉：未補入 | — |
| 拇趾長伸肌腱鞘 | Tendon sheath of extensor hallucis longus | 未分類 | 非肌肉：未補入 | — |
| 拇指長伸肌腱鞘 | Tendon sheath of extensor pollicis longus | 前臂手部 | 非肌肉：未補入 | — |
| 橈側伸腕肌腱鞘 | Tendon sheath of extensors carpi radialis | 前臂手部 | 非肌肉：未補入 | — |
| 橈側屈腕肌腱鞘 | Tendon sheath of flexor carpi radialis | 前臂手部 | 非肌肉：未補入 | — |
| 趾長屈肌腱鞘 | Tendon sheath of flexor digitorum longus | 未分類 | 非肌肉：未補入 | — |
| 拇趾長屈肌腱鞘 | Tendon sheath of flexor hallucis longus | 未分類 | 非肌肉：未補入 | — |
| 拇指長屈肌腱鞘 | Tendon sheath of flexor pollicis longus | 未分類 | 非肌肉：未補入 | — |
| 脛前肌腱鞘 | Tendon sheath of tibialis anterior | 未分類 | 非肌肉：未補入 | — |
| 脛後肌腱鞘 | Tendon sheath of tibialis posterior muscle | 未分類 | 非肌肉：未補入 | — |
| 闊筋膜張肌 | Tensor fasciae latae | 未分類 | 已有對應 | FJ1438, FJ1438M |
| 大圓肌 | Teres major muscle | 上臂肩部 | 已有對應 | FJ1507M, FJ1507 |
| 小圓肌 | Teres minor muscle | 上臂肩部 | 已有對應 | FJ1508M, FJ1508 |
| 甲杓肌甲會厭部 | Thyro-epiglottic part of thyro-arytenoid muscle | 未分類 | 缺少：已補模型 | — |
| 甲狀舌骨肌 | Thyrohyoid muscle | 頭頸 | 已有對應 | FJ1577, FJ1599 |
| 脛前肌 | Tibialis anterior muscle | 未分類 | 已有對應 | FJ1439M, FJ1439 |
| 脛後肌 | Tibialis posterior muscle | 未分類 | 已有對應 | FJ1440M, FJ1440 |
| 腹橫筋膜 | Transversalis fascia | 脊胸腹 | 非肌肉：未補入 | — |
| 杓橫肌 | Transverse arytenoid muscle | 未分類 | 缺少：已補模型 | — |
| 拇趾內收肌橫頭 | Transverse head of adductor hallucis | 骨盆大腿 | 缺少：已補模型 | — |
| 拇指內收肌橫頭 | Transverse head of adductor pollicis | 骨盆大腿 | 缺少：已補模型 | — |
| 小腿橫肌間隔 | Transverse intermuscular septum of leg | 腿腳 | 非肌肉：未補入 | — |
| 斜方肌橫部 | Transverse part of trapezius muscle | 脊胸腹 | 已有對應 | FJ1554M, FJ1554 |
| 腹橫肌 | Transversus abdominis muscle | 脊胸腹 | 已有對應 | FJ1461M, FJ1461 |
| 胸橫肌 | Transversus thoracis muscle | 未分類 | 缺少：已補模型 | — |
| 臀大肌轉子滑囊 | Trochanteric bursa of gluteus maximus muscle | 未分類 | 非肌肉：未補入 | — |
| 臀中肌轉子滑囊 | Trochanteric bursa of gluteus medius muscle | 未分類 | 非肌肉：未補入 | — |
| 臀小肌轉子滑囊 | Trochanteric bursa of gluteus minimus muscle | 未分類 | 非肌肉：未補入 | — |
| 上斜肌滑車 | Trochlea of superior oblique muscle | 脊胸腹 | 非肌肉：未補入 | — |
| 尺側伸腕肌尺骨頭 | Ulnar head of extensor carpi ulnaris | 前臂手部 | 只有整組：已補獨立分部 | FJ1472M, FJ1472 |
| 尺側屈腕肌尺骨頭 | Ulnar head of flexor carpi ulnaris | 前臂手部 | 只有整組：已補獨立分部 | FJ1498M, FJ1498 |
| 股中間肌 | Vastus intermedius muscle | 未分類 | 已有對應 | FJ1443M, FJ1441M, FJ1443, FJ1441 |
| 股外側肌 | Vastus lateralis muscle | 未分類 | 缺少：已補模型 | — |
| 股內側肌 | Vastus medialis muscle | 未分類 | 已有對應 | FJ1442M, FJ1442 |
| 腰外側橫突間肌腹側部 | Ventral parts of lateral intertransversarii lumborum muscles | 未分類 | 缺少：已補模型 | — |
| 顴大肌 | Zygomaticus major muscle | 頭頸 | 缺少：已補模型 | — |
| 顴小肌 | Zygomaticus minor muscle | 頭頸 | 缺少：已補模型 | — |

## 原來源獨有或尚無精確對應的項目

- FJ1555 · 二腹肌 · digastric（整組，預設隱藏）
- FJ1556 · 二腹肌 · digastric（整組，預設隱藏）
- FJ1560 · 二腹肌 · digastric（整組，預設隱藏）
- FJ1578 · 二腹肌 · digastric（整組，預設隱藏）
- FJ1579 · 二腹肌 · digastric（整組，預設隱藏）
- FJ1551 · 棘肌 · interspinalis muscle
- FJ1551M · 棘肌 · interspinalis muscle
- FJ1472M · 左尺側腕伸肌 · L extensor carpi ulnaris（整組，預設隱藏）
- FJ1498M · 左尺側腕屈肌 · L Flexor Carpi Ulnaris（整組，預設隱藏）
- FJ1475M · 左指淺屈肌 · L flexor digitorum superficialis（整組，預設隱藏）
- FJ1474M · 左旋前圓肌 · L pronator teres（整組，預設隱藏）
- FJ1538M · 左半棘肌 · L semispinalis（整組，預設隱藏）
- FJ1539M · 左豎脊肌 · Left erector spinae
- FJ1416M · 左拇短屈肌 · Left flexor hallucis brevis（整組，預設隱藏）
- FJ1541M · 左多裂肌 · Left multifidus（整組，預設隱藏）
- FJ1446M · 左胸大肌 · Left pectoralis major（整組，預設隱藏）
- FJ1543M · 左斜角肌 · Left scalene（整組，預設隱藏）
- FJ1542M · 左夾肌 · Left splenius（整組，預設隱藏）
- FJ1472 · 右尺側腕伸肌 · R extensor carpi ulnaris（整組，預設隱藏）
- FJ1498 · 右尺側腕屈肌 · R Flexor Carpi Ulnaris（整組，預設隱藏）
- FJ1475 · 右指淺屈肌 · R flexor digitorum superficialis（整組，預設隱藏）
- FJ1474 · 右旋前圓肌 · R pronator teres（整組，預設隱藏）
- FJ1538 · 右半棘肌 · R semispinalis（整組，預設隱藏）
- FJ1539 · 右豎脊肌 · Right erector spinae
- FJ1416 · 右拇短屈肌 · Right flexor hallucis brevis（整組，預設隱藏）
- FJ1541 · 右多裂肌 · Right multifidus（整組，預設隱藏）
- FJ1446 · 右胸大肌 · Right pectoralis major（整組，預設隱藏）
- FJ1543 · 右斜角肌 · Right scalene（整組，預設隱藏）
- FJ1542 · 右夾肌 · Right splenius（整組，預設隱藏）
- FJ1549 · 橫突間肌 · set of anterior cervical intertransversarii
- FJ1549M · 橫突間肌 · set of anterior cervical intertransversarii
- FJ1553 · 橫突間肌 · set of posterior cervical intertransversarii
- FJ1553M · 橫突間肌 · set of posterior cervical intertransversarii
- FJ2779 · 甲狀舌骨肌 · thyrohyoid ligament
- FJ2790 · 甲狀舌骨肌 · thyrohyoid ligament
- FJ2797 · 甲狀舌骨肌 · thyrohyoid ligament
- FJ2786 · 甲狀舌骨肌 · thyrohyoid membrane
- FJ2804 · 甲狀舌骨肌 · thyrohyoid membrane
