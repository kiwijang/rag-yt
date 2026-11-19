# Startup.blend 肌肉模型與互動架構

目前 `/muscles` 使用 `startup-reconciled/atlas.glb`。肌肉的形狀與分部以使用者提供的 `C:\Users\阿米\Documents\Z-Anatomy\Startup.blend` 為準；完整新增／整併清單見 [Startup 肌肉整理](startup-muscle-reconciliation.md)。

後腦、枕下與頸後的顯示檢查詳見 [後腦肌肉檢查](posterior-muscle-audit.md)。

## 目前內容

- Startup 實際 Muscles 集合：232 種肌肉／分部、462 個左右側與中線網格。
- 保留原來源獨有的前、後頸部橫突間肌共 4 個物件，Startup 未提供精確對應，沒有猜測刪除。
- 已補入 Startup 的左右帽狀腱膜（Epicranial aponeurosis），歸類為頭頸支持結構；可點選查看名稱，透過支持結構透明度調整，且不參與肌肉爆炸圖。
- 活躍模型共 **466 個肌肉、238 個骨骼系統構件、8 個筋膜相關支持結構，合計 712 個物件**。
- 補上原本缺少的右腹內斜肌，ID 為 `ZA:internal-abdominal-oblique:right`。
- 移除 31 個同側解剖身份重複或與細分模型重疊的整組網格，包含股中間肌同側多份；左右側與不同肌頭／肌肉分部各自保留。
- 原本誤標為肌肉的纖維鞘十字部、手指滑液鞘共 4 個物件改為支持結構，沒有刪除。

去重依來源權威下的肌肉／側別與整組－細分關係，不宣稱跨來源頂點完全相同。保留全部舊編號的有效定位：31 個移除 ID 記錄於 aliases，完整分部候選另存 redirects。頭部 22 個骨骼已改用同一 Startup 的對應網格，以修正頭骨遮住枕肌；其餘骨骼與資料庫未更動。

## 檔案

- `assets/anatomy/startup-reconciled/atlas.glb`：目前載入的合併資產。
- 同目錄 `catalog.json`：來源雜湊、232 種肌肉對應、逐項動作、分類、ID、別名、配色、平移對齊紀錄。
- 同目錄 `ATTRIBUTION.md`：Z-Anatomy、BodyParts3D／DBCLS、muscle-atlas-3d 的來源與授權歸屬。
- `active-anatomy.generated.ts`：目前 Angular 清單與模型 ID。`muscle-catalog.ts` 的 `resolveAnatomyId()` 處理舊 ID 定位。
- `models/startup-audit/source-muscles.json`、`muscles.glb`：原始 Startup 肌肉的讀取／匯出稽核資料。
- `scripts/anatomy/export-startup-muscles.py`：Blender 背景讀取與獨立匯出。
- `frontend/scripts/reconcile-startup-anatomy.mjs`：同側對應、去重、保留來源獨有部件、材質、別名與活躍資產生成。

原始 Startup.blend SHA-256 為 `9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd`。停用原檔內嵌 Python，沒有儲存／覆寫原檔。先前的 muscle-atlas-3d、trigger-point-combined、Z-Anatomy GLB、Blender 工作檔也保留作歷史來源，目前頁面不載入那些合併模型。

## 分類與操作

保留六大部位：頭頸、前臂手部、腿腳、上臂肩部、骨盆大腿、脊胸腹。逐項依解剖身份修正歸屬，補齊原未分類 219 個物件、修正 46 個主分類，44 個跨部位物件保留多重歸屬。原分類存於 originalZone / originalZones；詳見 [分類檢查](anatomy-classification-audit.md)。平面症狀地圖的七個症狀大區是另一層查詢入口。

系統選項為全部顯示、肌筋膜系統、骨骼系統。骨骼系統保留原 238 個構件，包含來源的軟骨、椎間盤與參考網格，不等同人體骨頭數。5 個甲狀舌骨韌帶／膜物件不列入活躍模型，原始資產保留。可按系統、部位、中文、英文或 ID 搜尋。點選模型時，視窗左下角固定顯示中文、英文、編號及側別，名稱卡不攔截旋轉／點選。可隔離、聚焦、前後視角、調整透明度並帶入 LLM／RAG。

清單按鈕、模型點選與定位連結共用 `select()`：所選結構維持 100% 高亮，其他肌肉預設 20%；清除選取恢復 100%。進入定位連結時，模型載入後將所選肌肉置中並縮放。舊 ID 先對應目前保留的 ID，再進行定位。正常手動旋轉不會被持續拉回。

爆炸圖須先選擇部位分類，只平移該分類的肌肉；其他肌肉、骨骼與支持結構維持原位。切換分類會收合，收合精確回原位。只看骨骼系統時不能展開。模型已直接去除重複整組，無需舊的「顯示整組肌肉」選項。

## 幾何與授權

Startup 網格依原有 modifiers 與世界矩陣匯出，再轉 glTF 軸向並套用既有的單一平移以對齊保留的骨骼。沒有雕塑、任意縮放或增加肌肉量；來源間姿勢仍有差異，不是醫學影像配準。原檔未標 `.l` 的左頸髂肋肌，依同名 `.r` 與正 X 範圍辨識，詳細資料有 sideInferred 紀錄。

Z-Anatomy 肌肉衍生資料保留 CC BY-SA 4.0；底層 BodyParts3D／DBCLS 與 muscle-atlas-3d 保留各自的 CC BY-SA 2.1 Japan 來源說明。完整連結與貢獻者列於資產歸屬文件。此模型沒有可用皮膚或激痛點資料；顏色只區分鄰近肌群。

## 重建與驗證

在 frontend 執行 `npm run anatomy:reconcile-startup`，預設讀取 `../Z-Anatomy/Startup.blend`。可傳入別的路徑，或以 `BLENDER_PATH` 指定 Blender。`--reuse-export` 僅在原檔 SHA 與匯出資料一致時使用已匯出資料，不會靜默接受不同版本。

- `tests/Anatomy.Checks/verify-startup.py`：Blender 直接比對原檔的 462 個肌肉、2 個帽狀腱膜與 22 個頭骨物件和最終 GLB，雙向最近頂點容許誤差 2 微米，並確認原檔雜湊不變。
- `tests/Anatomy.Checks/check-startup.mjs`：活躍 ID／分類／側別唯一性、缺少側別、31 個舊 ID 別名、來源覆蓋、約 124 萬頂點及配色。
- `tests/Chat.Checks/check-atlas.cjs`：實際模型載入、點選名稱、搜尋、分類、透明度、區域爆炸圖、手機版與還原。
- `tests/SymptomMap.Checks`：七個症狀大區、21 條流程與活躍模型部件、舊定位 ID、鏡頭置中。

先前 `check-combined.mjs`、`verify-blender.py` 驗證的是歷史資產，不是目前的活躍模型。



