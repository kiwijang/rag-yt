# Startup.blend 肌肉整理

原檔 SHA-256：`9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd`。讀取時停用內嵌 Python，未儲存或覆寫原檔。

## 結果

- Startup 的 Muscles 集合扣除明確非肌肉後，有 232 種肌肉／分部、462 個左右側與中線物件，全數以原始網格匯入。
- 新增 1 個先前缺少的側別；移除 31 個同名同側重複或與細分部重疊的整組網格。左右側與不同分部不視為重複。
- 補入 2 個帽狀腱膜物件（左右側），歸類為支持結構，可在前端點選並調整透明度。
- 4 個腱鞘物件改歸支持結構，未刪除。
- 4 個原來源獨有的頸部橫突間肌物件因 Startup 沒有精確對應而保留，未憑名稱猜測刪除。
- 現在 466 肌肉、238 骨骼、8 支持結構，共 712 個。保留原骨骼 ID，頭部 22 個骨骼改用同一份 Startup 網格，避免異來源頭骨蓋住枕肌；其餘骨骼保留原資料。

## 方法與相容性

Startup 是本次肌肉形狀與分部的權威來源。同一個肌肉／側別只保留一份；既有 FJ／TP ID 能沿用則沿用，新增部件使用 ZA ID。被整併的舊 ID 保存在 catalog.json 的 aliases（預設定位）與 redirects（完整候選）；重複整組的舊連結會定位到相同側別的一個細分部，不代表其餘分部不存在。

新肌肉僅套用 Startup 原有世界矩陣、glTF 座標轉換及先前的單一平移，以保留現有骨骼的座標基準；沒有任意放大、雕塑或增加肌肉量。原來源之間仍有姿勢差異，這不是醫學影像配準。sourceSideInferred 記錄原檔未標 .l 的左頸髂肋肌：依同名 .r 與正 X 位置辨識，沒有新增假肌肉。

保留六個部位分類，依解剖身份修正歸屬，跨部位結構保留多重分類；原分類存於 originalZone / originalZones。僅啟用肌筋膜與骨骼系統，5 個甲狀舌骨韌帶／膜物件不列入活躍模型，原始來源保留。完整對照見 [分類檢查](anatomy-classification-audit.md)。這次新增獨立資產 startup-reconciled，不覆寫之前兩份 GLB。肌肉部件以 Startup 網格取代既有同名網格；所以這裡的去重是來源權威下的解剖身份／分部整併，不宣稱不同來源頂點完全相同。

## 完整變更

| 動作 | ID | 肌肉／分部 | 取代後 ID（若多個則為分部） |
| --- | --- | --- | --- |
| added-support-structure | ZA:epicranial-aponeurosis:left | Epicranial aponeurosis | — |
| added-support-structure | ZA:epicranial-aponeurosis:right | Epicranial aponeurosis | — |
| replaced-misaligned-head-bone | FJ3199 | Ethmoid bone | — |
| replaced-misaligned-head-bone | FJ3200 | Frontal bone | — |
| replaced-misaligned-head-bone | FJ3263 | Left inferior nasal concha | — |
| replaced-misaligned-head-bone | FJ3369 | Right inferior nasal concha | — |
| added-missing-side | ZA:internal-abdominal-oblique:right | Internal abdominal oblique muscle | — |
| replaced-misaligned-head-bone | FJ3265 | Left lacrimal bone | — |
| replaced-misaligned-head-bone | FJ3371 | Right lacrimal bone | — |
| replaced-misaligned-head-bone | FJ3289 | Mandible | — |
| replaced-misaligned-head-bone | FJ3269 | Left maxilla | — |
| replaced-misaligned-head-bone | FJ3375 | Right maxilla | — |
| replaced-misaligned-head-bone | FJ3272 | Left nasal bone | — |
| replaced-misaligned-head-bone | FJ3378 | Right nasal bone | — |
| replaced-misaligned-head-bone | FJ3309 | Occipital bone | — |
| replaced-misaligned-head-bone | FJ3273 | Left palatine bone | — |
| replaced-misaligned-head-bone | FJ3379 | Right palatine bone | — |
| replaced-misaligned-head-bone | FJ3274 | Left parietal bone | — |
| replaced-misaligned-head-bone | FJ3380 | Right parietal bone | — |
| replaced-misaligned-head-bone | FJ3394 | Sphenoid bone | — |
| replaced-misaligned-head-bone | FJ3281 | Left temporal bone | — |
| replaced-misaligned-head-bone | FJ3386 | Right temporal bone | — |
| replaced-misaligned-head-bone | FJ3395 | Vomer | — |
| replaced-misaligned-head-bone | FJ3287 | Left zygomatic bone | — |
| replaced-misaligned-head-bone | FJ3392 | Right zygomatic bone | — |
| overlapping-whole-muscle | FJ1555 | digastric | TP:0, TP:1, TP:69, TP:70 |
| overlapping-whole-muscle | FJ1556 | digastric | TP:1, TP:0, TP:70, TP:69 |
| overlapping-whole-muscle | FJ1560 | digastric | TP:0, TP:1, TP:69, TP:70 |
| overlapping-whole-muscle | FJ1578 | digastric | TP:69, TP:0, TP:70, TP:1 |
| overlapping-whole-muscle | FJ1579 | digastric | TP:70, TP:1, TP:69, TP:0 |
| overlapping-whole-muscle | FJ1551 | interspinalis muscle | TP:421, TP:420, FJ1552, FJ1552M, FJ1550, FJ1550M |
| overlapping-whole-muscle | FJ1551M | interspinalis muscle | TP:420, TP:421, FJ1552M, FJ1552, FJ1550M, FJ1550 |
| overlapping-whole-muscle | FJ1472M | L extensor carpi ulnaris | TP:170, TP:220 |
| overlapping-whole-muscle | FJ1498M | L Flexor Carpi Ulnaris | TP:172, TP:222 |
| overlapping-whole-muscle | FJ1475M | L flexor digitorum superficialis | TP:174, TP:195 |
| overlapping-whole-muscle | FJ1474M | L pronator teres | TP:197, TP:139 |
| overlapping-whole-muscle | FJ1538M | L semispinalis | TP:483, TP:488 |
| duplicate-anatomical-identity | FJ1443M | L Vastus Intermedius | FJ1441M |
| overlapping-whole-muscle | FJ1539M | Left erector spinae | FJ1534M, FJ1526M, TP:498, FJ1533M, TP:496, FJ1528M, FJ1544M, FJ1535M, FJ1527M |
| overlapping-whole-muscle | FJ1416M | Left flexor hallucis brevis | TP:245, TP:241 |
| overlapping-whole-muscle | FJ1541M | Left multifidus | TP:433, TP:438, TP:431 |
| overlapping-whole-muscle | FJ1446M | Left pectoralis major | TP:359, FJ1464M, FJ1447M |
| overlapping-whole-muscle | FJ1543M | Left scalene | TP:75, TP:73, TP:71 |
| overlapping-whole-muscle | FJ1542M | Left splenius | TP:507, TP:505 |
| overlapping-whole-muscle | FJ1472 | R extensor carpi ulnaris | TP:171, TP:221 |
| overlapping-whole-muscle | FJ1498 | R Flexor Carpi Ulnaris | TP:173, TP:223 |
| overlapping-whole-muscle | FJ1475 | R flexor digitorum superficialis | TP:175, TP:196 |
| overlapping-whole-muscle | FJ1474 | R pronator teres | TP:198, TP:140 |
| overlapping-whole-muscle | FJ1538 | R semispinalis | TP:484, TP:489 |
| duplicate-anatomical-identity | FJ1443 | R Vastus Intermedius | FJ1441 |
| overlapping-whole-muscle | FJ1539 | Right erector spinae | FJ1534, TP:499, FJ1526, FJ1533, TP:497, FJ1528, FJ1544, FJ1535, FJ1527 |
| overlapping-whole-muscle | FJ1416 | Right flexor hallucis brevis | TP:246, TP:242 |
| overlapping-whole-muscle | FJ1541 | Right multifidus | TP:434, TP:439, TP:432 |
| overlapping-whole-muscle | FJ1446 | Right pectoralis major | TP:360, FJ1464, FJ1447 |
| overlapping-whole-muscle | FJ1543 | Right scalene | TP:76, TP:74, TP:72 |
| overlapping-whole-muscle | FJ1542 | Right splenius | TP:508, TP:506 |
| retained-source-only-muscle | FJ1549 | set of anterior cervical intertransversarii | — |
| retained-source-only-muscle | FJ1549M | set of anterior cervical intertransversarii | — |
| retained-source-only-muscle | FJ1553 | set of posterior cervical intertransversarii | — |
| retained-source-only-muscle | FJ1553M | set of posterior cervical intertransversarii | — |
| reclassified-sheath | TP:138 | Cruciform part of fibrous sheath of digit of hand | — |
| reclassified-sheath | TP:216 | Cruciform part of fibrous sheath of digit of hand | — |
| reclassified-sheath | TP:211 | Synovial sheaths of digits of hand | — |
| reclassified-sheath | TP:212 | Synovial sheaths of digits of hand | — |

## 重建

在 frontend 執行 `npm run anatomy:reconcile-startup`，預設讀取 ../Z-Anatomy/Startup.blend。可傳入其他來源路徑，或設定 BLENDER_PATH。原始檔案與舊資產保留不修改。
