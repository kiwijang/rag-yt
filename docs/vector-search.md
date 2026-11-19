# BGE-M3、Jina CLIP v2 與 Weaviate

## 架構與資料用途

PostgreSQL 是原始資料來源，Weaviate 是可重建的搜尋索引。建立索引不修改逐字稿、PDF、切塊文字或原始語言。管理切塊的儲存操作則明確修改該切塊並更新 embedding；不需要新的 PostgreSQL migration。

```text
最新版本逐字稿切塊 ─┐
PDF 文字切塊 ──────┴→ C# → BGE-M3 dense 1024 維 → RagBgeM3V1
MinerU PDF 頁面 PNG ─→ C# → Jina CLIP v2 1024 維 → RagJinaClipV2V1
                                 ↓
查詢原文 → BGE-M3 文字向量 + BM25 / Jina 文字向量查頁面圖片
                                 ↓
              比對 PostgreSQL 最新資料與內容雜湊 → 合併排名 → UI 引用與預覽
```

BGE-M3 使用 dense 向量，混合搜尋的關鍵字部分由 Weaviate BM25 提供；目前沒有使用 BGE 自帶 sparse 或 ColBERT 輸出。Weaviate 1.25.5 啟用 `USE_GSE=true`，文字欄位使用 `gse` 斷詞。中、英、日文直接輸入模型，不額外翻譯。

### 逐字稿使用原文索引

逐字稿的 BGE-M3 輸入使用 `YoutubeTranscriptSegments.Text` 原文，不使用 `TraditionalChineseText`。新切塊也使用原文，metadata 的 `textSource=original` 記錄來源。翻譯仍保留在原始字幕資料供閱讀對照。

舊切塊可能存的是譯文或曾手動修改的文字：建立 embedding 時依 `firstSequence/lastSequence` 讀取對應原文字幕範圍，**不修改舊 RagDocumentChunks.Content、不刪除重建切塊、不重新轉錄**。缺少原文不會以機器譯文替代。

管理視窗以 `embeddingText` 顯示原文編輯內容，原有 `content` 保留在對照區。只有明確按儲存時，才將修正後的原文寫入該切塊並標記 `textSource=original-edited`，同時更新向量；原始字幕和譯文不變。API 的 `originalContent` 仍須送載入時的原始 `content`，供衝突偵測。

逐字稿向量的 modelKey 改為 `transcript-original-v2`，PDF 文字及 Jina 圖像的 key 不變。新版 API 啟動後，按 YouTube 來源的「進行 embedding」即可重算舊逐字稿向量，**不必按「重建搜尋片段」**；原文模式不接受舊譯文向量。完成前該來源可能暫無有效語意搜尋結果。API 若正在轉錄，先讓工作完成，再以 start-all.bat 載入新版；前端會以 `supportsOriginalTextEmbedding` 停用不支援原文模式的舊 API 操作。

Jina 的圖像單位目前是完整 PDF 頁面，不是每一張插圖；以 MinerU 產生的頁面 PNG 建立向量。頁面原文會同時作為搜尋結果摘要，頁碼可展開受驗證的圖片預覽。沒有預覽 PNG 的舊 PDF 頁面仍可文字檢索，產生 MinerU 預覽後再更新索引即可加入圖像搜尋。

文字與圖片分開建 collection，模型各自的查詢向量必須進入相同模型的索引。結果以 reciprocal rank（`1 / (60 + rank)`）合併，分數用於排序，不是可信度或兩模型可直接比較的餘弦距離。

## 啟動與操作

1. 雙擊根目錄 `start-all.bat`，會先建置／啟動 embedding、Weaviate 與 MinerU，再啟動 API、Angular。GPU 版需要 Docker Desktop 的 NVIDIA GPU 支援；CPU 版可用 `docker compose -f docker-compose.yml -f docker-compose.mineru-cpu.yml up -d --build`。
2. 管理員登入，在 RAG Search 的「Weaviate 向量索引」按「建立／更新索引」。初次執行下載模型至 `embedding_models` Docker volume，需網路和數 GB 空間。
3. 進度顯示本次已檢查／總數與更新數。可停止；會等目前推論批次完成、釋放 CUDA 後停止。再次執行只處理尚未完成或內容已變更的資料。
4. 搜尋選「混合搜尋」或「語意搜尋」，可勾選 Jina 圖像搜尋；結果標示模型與文字／圖像命中，PDF 可展開頁面預覽。
5. 在「管理 RAG 切塊」按「儲存並更新 embedding」，單一後端 PUT 會一併更新。也可在管理視窗為整版逐字稿進行 embedding。Synced videos 按鈕處理該來源所有影片的最新已存逐字稿（不限目前 tab）；PDF OCR Sources 每筆來源的按鈕只處理該 PDF 文字及頁面圖像。這些按鈕不重新轉錄或 OCR。

```powershell
docker compose logs -f embedding weaviate
Invoke-RestMethod http://127.0.0.1:8091/health
```

embedding 的 health 表示 HTTP 與 CUDA 可用；模型採延遲載入，health 不代表模型已下載完成。首次推論會較久。正常完成一次推論後，模型權重回到 CPU 並清除 CUDA cache；CPU 權重留在程序內以加速後續查詢，仍會占用系統記憶體。

## API 用法

下列路徑都需 Bearer token；index 系列限 Admin。

| 請求 | 用途 |
| --- | --- |
| `POST /api/Rag/index` | 無 body；排入一次全來源增量更新，回 202；已有工作回 409 |
| `POST /api/Rag/index?sourceType=1&sourceId=3` | 只處理該 YouTube 來源的最新逐字稿 |
| `POST /api/Rag/index?sourceType=2&sourceId=3` | 只處理該 PDF 的文字與頁面圖像 |
| `POST /api/Rag/index?sourceType=1&sourceId=3&transcriptId=26` | 只處理該最新逐字稿版本；歷史版本回 409 |
| `PUT /api/SourceManagement/youtube/{sourceId}/transcripts/{transcriptId}/chunks/{chunkId}` | body：content、originalContent；儲存切塊與 embedding 的單一請求 |
| `GET /api/Rag/index/status` | 讀取 state、processed、total、updated、error |
| `POST /api/Rag/index/cancel` | 停止目前索引工作，不刪除已完成向量 |
| `GET /api/Rag/search?Query=骨盤を安定させる筋肉&Mode=hybrid&IncludeImages=true&Take=20` | 混合文字＋圖像搜尋 |
| `GET /api/Rag/search?Query=骨盆&SourceType=2&SourceId=3&Mode=vector&IncludeImages=false` | 限 PDF 來源 #3，純文字語意搜尋 |

`Mode=keyword` 使用 PostgreSQL 子字串搜尋。向量服務故障或 collection 尚未建立時，回應 `searchMode=keyword-fallback` 與 `warning`，UI 會明示；不會把關鍵字結果冒稱向量結果。沒有命中的有效向量可能代表尚未更新索引。

## 索引一致性、GPU 與失敗處理

### 編輯切塊的提交方式

PostgreSQL 與 Weaviate 沒有共同的分散式交易，因此不宣稱兩個儲存系統能實體原子提交。後端採不可變的向量版本，UUID 包含 chunk ID 與內容雜湊：

1. 鎖定索引寫入，核對 originalContent，先產生並寫入新版本向量，保留原向量。
2. PostgreSQL 交易更新切塊並提交。搜尋一律依 PostgreSQL 的當前內容雜湊接受向量，因此提交前只能接受舊版本，提交後只能接受新版本。
3. 成功後清理其他向量版本。若這一步失敗，回應 `embeddingUpdated=true, cleanupPending=true`，不把成功儲存錯報為已回滾。
4. 推論或向量寫入失敗回 503，切塊不變。SQL 寫入失敗保留原內容及原向量；已暫存但未提交的新向量不參與搜尋。HTTP 中斷或提交結果不明時，重新載入後核對內容再重試。
5. 後端在無索引工作時每五分鐘清理未提交或過期文字向量；全部／來源索引完成後也會清理。清理會重新鎖定並核對最新資料，避免刪掉另一個剛成功儲存的版本。

來源 embedding 是背景增量作業，進度與失敗以工作狀態呈現，可重試接續，不宣稱整個來源的數千個向量在同一交易提交。

### 前端 API 產生方式

`GET index/status` 的 `supportsScopedEmbedding`、`supportsAtomicChunkEmbedding` 表示後端支援新操作。舊 API 沒有這些旗標時，前端停用來源 embedding 與合併儲存按鈕，避免 UI 先更新卻由舊 API 只儲存文字。若 API 正在轉錄，先完成工作再重新啟動載入新版。

索引、狀態、預覽使用 OpenAPI 產生的 `RagService`；切塊管理 CRUD 使用產生的 `TranscriptChunksService`。前端沒有自行串接「先儲存、再呼叫 embedding」的兩個寫入操作。`vector-index.ts` 只保留 UI 的進度型別，不含 HTTP 呼叫。後端啟動後可在 frontend 執行 `npm run generate:api` 重新產生。

索引器只收錄啟用來源的 PDF 切塊，以及每支影片最新逐字稿的切塊，略過影片清單 metadata。模型版本、內容、來源與頁碼會計入 SHA-256；圖片額外計入 PNG 雜湊。批次索引 UUID 由 collection＋資料 ID 決定；切塊編輯則使用 ID＋內容雜湊建立不可變版本，提交後移除其他版本。重跑同一版本不會新增重複物件。索引狀態保存在 Weaviate 物件的 `contentHash/modelKey`；API 重啟後重新按更新即可接續。

一輪所有當前資料都成功寫入後才刪除過期向量。搜尋時再核對 PostgreSQL 啟用狀態、最新逐字稿、內容雜湊與圖片資產；因此舊向量可能暫留 Weaviate，但不會作為有效命中回傳。異動中的資料會等下一輪更新才可搜尋。

同一 API 的語音辨識、OCR 和索引 GPU 工作共用 `GpuInferenceService`；批次文字 8 段、圖片 1 頁。索引開始前會釋放既有語音模型 GPU 權重。短查詢預設 CPU，避免查詢造成語音 GPU 模型重載。PostgreSQL advisory lock 防止不同 API 同時建立索引；不同 API 的其他推論作業仍應避免共用一張 GPU 同時執行。

設定可用環境變數覆寫：`Embeddings__ServiceUrl`（預設 loopback 8091）、`Weaviate__Url`（8080）、`Embeddings__IndexDevice`（auto）、`Embeddings__QueryDevice`（cpu；BGE 查詢）。Jina 查詢固定 CPU。Docker 埠僅綁定 loopback，應由具權限驗證的 API 呼叫推論，勿對外暴露原始服務。

## 備份與復原

現有 `backup.bat` 備份 PostgreSQL、原始 PDF、MinerU 預覽與 migrations，**不包含 Weaviate 向量或模型快取**。這兩者是可由上述原始資料及固定版本程式碼重建的衍生資料。請保留專案版本與本文件：

1. 依既有備份文件還原並驗證 PostgreSQL、PDF、預覽。
2. 啟動同版本 embedding、Weaviate、API。
3. 管理員按「建立／更新索引」。空索引會全部重建；已有索引會比對內容並補齊、清除過期物件。
4. 以來源與頁碼抽查中、日文文字命中和圖像預覽。完成之前，資料庫備份驗證成功不等於向量服務已恢復可用。

## 固定版本與授權

- [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3)：MIT；模型 revision `5617a9f61b028005a4858fdac845db406aefb181`。
- [jinaai/jina-clip-v2](https://huggingface.co/jinaai/jina-clip-v2)：**CC-BY-NC-4.0，非商用授權**；商業使用須另確認取得適用授權。模型 revision `e10d47f5691d0454a0fb5d13f46f2199b74cb436`。
- Jina CLIP custom code `39e6a55ae971b59bea6e44675d237c99762e7ee2`；內嵌 text tower configuration `ab036b023d30b4d1138c4c3bfa9f0c445ab455d6`；text tower code `bd55a5ec8e6c0fb1d6c26efb4b6a4a74ce8a88d3`。全部固定 revision，未使用浮動 main 的推論程式碼。

## 驗證

`dotnet run --project tests/VectorSearch.Checks -- <PDF 頁面 PNG 路徑>` 會建立隨機命名的暫存 Weaviate collections（文字與圖片分開），驗證中日文跨語言搜尋、來源過濾、更新不重複、刪除與真實圖片 GPU 推論，再刪除自己的測試 collections；不修改 PostgreSQL。另需執行 `dotnet build Rag.Api` 與前端 `npx nx build frontend --skip-nx-cache`。

UI 煙霧測試在 Angular 啟動後執行 `node tests/VectorSearch.Checks/check-ui.cjs`，需另外安裝 Playwright 或用 `PLAYWRIGHT_MODULE` 指定其模組路徑。測試會攔截所有 API 呼叫，驗證索引進度／停止、搜尋模式參數、文字／圖像同 ID 呈現與圖片展開，不寫入真實資料。

切塊一致性檢查：`dotnet run --project tests/ChunkEmbedding.Checks -p:UseAppHost=false`。它建立獨立的暫存 PostgreSQL 資料庫，以模擬推論／Weaviate 故障搭配真實 SQL 交易驗證成功、失敗、提交前後搜尋可見性、衝突及殘留向量清理，完成後移除自己的測試 DB；不修改正式資料庫或正式向量。另驗證日文完整字幕範圍、譯文異動不影響向量、原文異動觸發更新，以及舊切塊／手動註記不被自動改寫。UI 檢查為 `node tests/ChunkEmbedding.Checks/check-ui.cjs`，驗證原文編輯與舊文字對照、三種作用範圍、單一 PUT 儲存、失敗保留草稿與舊 API 防護。

### 2026-11-15 實機驗證

- 建立 3,800 筆文字向量與 119 筆 PDF 頁面向量；停止後可接續，完整重跑更新數為 0。
- BGE 與 Jina 圖片推論均確認 `device=cuda`、1024 維；查詢 CPU 路徑可用。
- 日文問題可命中中文逐字稿；混合搜尋同時包含 BGE 文字與 Jina 圖像結果。
- 直接以 Angular 連到 `5085` 的實際 API、Weaviate 與模型服務，搜尋顯示 20 筆結果，真實 PDF 頁面可展開並解碼。
- 一般 User 可讀取啟用 PDF 的搜尋預覽，但不能操作 Admin 索引 API（403）。模擬 Weaviate 連線失敗可明示回退關鍵字模式。
- 原 PostgreSQL 6,136 個切塊、690 版逐字稿、119 頁資料，索引前後筆數及整列內容指紋相同；未重新轉錄或重建 PDF。
- API 與 Angular 建置通過；既有前端 bundle／Stencil 警告，以及檢查專案還原時的既有 `Microsoft.Extensions.Caching.Memory 8.0.0` 弱點警告仍存在，未在這次功能中升級既有套件。
