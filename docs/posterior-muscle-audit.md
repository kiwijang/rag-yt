# 後腦、枕下與頸後肌肉覆蓋檢查

## 發現與修正

- Startup 可用的 232 種肌肉／分部、462 個肌肉物件均已在前端，逐一以 sourceObjectName 對照；沒有漏掉來源內的枕肌或枕下四肌。
- 原本使用另一個模型的頭骨，會蓋住 Startup 的枕肌。定位枕肌時即使高亮存在，畫面仍主要顯示骨頭。這是混合來源幾何不一致造成的遮擋。
- 頭部 22 個對應骨骼現改用同一 Startup.blend 網格與相同世界矩陣／平移，維持原 FJ ID。沒有將肌肉膨脹、移到骨頭外面，或靠永久隱藏骨骼掩蓋問題。
- 回歸測試在骨骼 100% 不透明時，檢查左右枕肌各自有超過 5000 個可見高亮像素，並驗證仍位於鏡頭中央。
- 分類現依實際部位修正：枕肌、枕下肌與頸後肌均可在頭頸找到；跨部位肌肉另保留脊胸腹等相關分類。原分類存於 originalZones，完整對照見 anatomy-classification-audit.md。

## 逐項結果

| 中文名稱 | 來源肌肉 | 物件數 | 修正後分類 | 定位 ID |
| --- | --- | --- | --- | --- |
| 左枕肌、右枕肌 | Occipitalis muscle | 2 | 頭頸 | TP:57, TP:58 |
| 左顳頂肌、右顳頂肌 | Temporoparietalis muscle | 2 | 頭頸 | TP:963, TP:964 |
| 左頭夾肌、右頭夾肌 | Splenius capitis muscle | 2 | 頭頸、脊胸腹 | TP:505, TP:506 |
| 左頸夾肌、右頸夾肌 | Splenius colli muscle | 2 | 頭頸、脊胸腹 | TP:507, TP:508 |
| 左頭最長肌、右頭最長肌 | Longissimus capitis muscle | 2 | 頭頸、脊胸腹 | FJ1533M, FJ1533 |
| 左頸最長肌、右頸最長肌 | Longissimus colli muscle | 2 | 頭頸、脊胸腹 | FJ1534M, FJ1534 |
| 左頸半棘肌、右頸半棘肌 | Semispinalis colli muscle | 2 | 頭頸、脊胸腹 | TP:483, TP:484 |
| 左胸半棘肌、右胸半棘肌 | Semispinalis thoracis muscle | 2 | 脊胸腹 | TP:488, TP:489 |
| 左頭棘肌、右頭棘肌 | Spinalis capitis muscle | 2 | 頭頸、脊胸腹 | TP:496, TP:497 |
| 左頸多裂肌、右頸多裂肌 | Multifidus colli muscle | 2 | 頭頸 | TP:431, TP:432 |
| 左頭後大直肌、右頭後大直肌 | Rectus posterior major capitis muscle | 2 | 頭頸 | TP:935, TP:936 |
| 左頭後小直肌、右頭後小直肌 | Rectus posterior minor capitis muscle | 2 | 頭頸 | TP:937, TP:938 |
| 左頭上斜肌、右頭上斜肌 | Obliquus superior capitis muscle | 2 | 頭頸 | TP:907, TP:908 |
| 左頭下斜肌、右頭下斜肌 | Obliquus inferior capitis muscle | 2 | 頭頸 | TP:905, TP:906 |
| 左斜方肌降部、右斜方肌降部 | Descending part of trapezius muscle | 2 | 頭頸、脊胸腹、上臂肩部 | FJ1521M, FJ1521 |
| 左帽狀腱膜、右帽狀腱膜 | Epicranial aponeurosis | 2 | 頭頸 | ZA:epicranial-aponeurosis:left, ZA:epicranial-aponeurosis:right |

## 來源本身未提供的獨立模型

以下名稱在這份 Startup.blend 中沒有獨立 Mesh，不能宣稱已從此檔補入，也沒有以近似名稱重新標示現有肌肉：

- Semispinalis capitis muscle
- Posterior auricular muscle
- Auricularis posterior

這份檢查針對提供的模型網格，不宣稱涵蓋所有解剖變異或理想完整人體。需要新增其他獨立肌肉時，仍須有可確認名稱、側別與形狀的來源。

## 可重現驗證

- scripts/anatomy/startup-head-bones.json：22 個保留 FJ ID 到 Startup 頭骨物件的明確對照。
- tests/Anatomy.Checks/check-startup.mjs：肌肉／支持結構／頭骨來源、完整性與逐頂點比對。
- tests/Anatomy.Checks/verify-startup.py：直接從原 blend 讀取並比對最終模型，確認原檔 SHA-256 未改。
- tests/SymptomMap.Checks/check-ui.cjs：不降低骨骼不透明度，實際渲染左右枕肌並驗證高亮面積。
