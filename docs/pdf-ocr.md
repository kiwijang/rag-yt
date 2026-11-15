# MinerU Docker 文件解析、文字框預覽與 RAG

## 架構

```text
start-all.bat → Docker Compose → MinerU（127.0.0.1:8090）
                                   ↑ HTTP multipart PDF
Angular → .NET PdfOcrService → PdfLayoutInferenceService
                                   ↓ ZIP（頁面結果、PNG、座標 JSON）
                     PdfPages + RagDocumentChunks + 私有預覽檔
```

所有 PDF 頁面統一交給 MinerU 解析，文字頁自動讀取內嵌文字，掃描頁執行 OCR。C# 負責選擇頁面、GPU 排隊、原文組合、切塊、資料庫交易與權限。Docker 內 Python 只負責 MinerU 推論及結果格式轉換，不連接資料庫。

固定使用 MinerU 2.7.6 的 `pipeline` backend，讓文字行與版面區塊都有可追蹤的座標；這是固定的整合版本，不代表最新版本。表格解析啟用，公式專用模型關閉。使用 PyTorch 2.7.1／CUDA 12.8 映像，沒有本機 OCR Python 環境的需求。

## 啟動

1. 啟動 Docker Desktop，使用 Linux containers；GPU 模式需要 Docker Desktop／WSL2 能存取 NVIDIA GPU。
2. 雙擊 `start-all.bat`。它先建置／檢查 MinerU，再依原流程啟動 Docker 服務、Angular、前景 API。首次映像及模型下載可能需數分鐘。
3. 不需單獨安裝文件推論的 Python 套件。`setup-pdf-ocr.bat` 仍可單獨準備 MinerU，但內容已改為 Docker Compose。
4. `start-all.bat --check` 只做檢查，不會安裝或啟停服務。

```powershell
# 只啟動 MinerU
powershell.exe -NoProfile -File scripts/setup-pdf-ocr.ps1

# 沒有 NVIDIA GPU 時以 CPU 啟動
powershell.exe -NoProfile -File scripts/setup-pdf-ocr.ps1 -Device cpu

# CPU 版 compose 設定會移除 GPU reservation
# start-all 也會按 PdfOcr__Device 或 nvidia-smi 是否存在選擇此組態
$env:PdfOcr__Device = 'cpu'
.\start-all.bat
```

MinerU 只發布至 `127.0.0.1:8090`，不對區網公開。它是供本機 .NET API 呼叫的解析服務，不是另一份資料庫。模型下載在名為 `mineru_models` 的 Docker volume 中快取；移除 volume 後需重新下載，不能把模型快取當成使用者資料備份。

## API 設定

```json
{
  "PdfOcr": {
    "ServiceUrl": "http://127.0.0.1:8090",
    "Device": "auto",
    "TimeoutMinutes": 30
  }
}
```

- `auto`：容器中的 CUDA 可用時使用 `cuda`，否則 CPU；`gpu` 要求 GPU，缺少 GPU 時回報失敗；`cpu` 強制 CPU。
- GPU 或 auto 會取得與 Whisper／NLLB 相同的推論鎖，先等當前語音推論完成並釋放其模型快取，再呼叫 MinerU。CPU 模式不占用語音推論鎖。
- 容器一次執行一份文件，每份文件由獨立子程序推論。子程序完成即退出以釋放 CUDA 記憶體，模型權重則留在磁碟快取。下一次語音推論會重新載入自己的模型。
- API 的鎖只協調同一 API 實例；不要啟動多個 API 實例搶同一張 GPU。容器鎖也不會替其他應用程式清理顯存。
- 預設總逾時 30 分鐘，可設 1～120 分鐘，含等待推論鎖的時間。HTTP 取消會傳到容器，容器終止解析子程序並清理該次暫存目錄。
- 若改為容器化 .NET API，ServiceUrl 應使用 `http://mineru:8000`，並加入相同 compose 網路。

## 日誌

```powershell
# 即時查看 MinerU 模型下載、解析、頁面完成及錯誤
# 結束觀看按 Ctrl+C，不會停止容器
docker compose logs -f --tail 100 mineru

# 健康檢查，顯示版本與 CUDA 可用性
Invoke-RestMethod http://127.0.0.1:8090/health
```

.NET 啟動視窗會顯示文件要求、頁數、裝置與解析結果。`start-all.bat` 的 Ctrl+C 仍停止前景 API；Docker 與 Angular 保持運作。若正在解析的 HTTP 請求因此中止，容器會終止該解析程序。

## PDF 上的 text detection 框

管理頁「查看 RAG 切塊」包含頁面預覽，可切頁、縮放、開關文字框與版面框。點選文字框可查看辨識文字及對應切塊，選取切塊也會切到對應頁面。

- 藍色：MinerU `middle.json` 中的逐行定位；橘色：選取文字或切塊；綠色：版面區塊。
- 座標不是把 `content_list` 的 0～1000 正規化座標當成像素使用。版面框乘上影像寬高比例；文字行框以 middle.json 的 PDF page_size 換算為像素。
- 底圖使用 MinerU 解析後保留的對應 PDF 頁面渲染，因此頁面旋轉與框線使用相同座標系。
- MinerU 沒有提供信心分數時顯示為未知，不捏造分數。表格內是否有逐行定位取決於 MinerU 輸出；版面表格框仍可顯示。
- 舊資料沒有預覽檔時 UI 會提示重建，不會拿舊座標錯畫在新影像上。空白頁沒有文字切塊，因此不提供文字框。

預覽保存在 `Rag.Api/uploads/pdf/ocr/<隨機版本ID>/page-N.png` 與 `.json`；RagDocumentChunks.MetadataJson 的 `ocrAssetId` 關聯該版本。透過有管理員權限的 API 取得，沒有公開的靜態目錄。不需要新增資料庫欄位。

備份腳本會遞迴備份 PDF 原檔與這些預覽資產，並在還原測試中驗證已引用的 PNG／JSON 都存在。請不要手動刪除仍被切塊引用的資產。重建後先保留舊資產供追溯；辨識失敗或交易失敗可能留下未引用檔案，後續可按版本關聯做安全垃圾回收，本次不自動刪除舊版本。

## 切塊與資料保護

- 每個 MinerU 文字區塊獨立切塊，不跨頁。一般段落最多 900 個 UTF-16 字元、約 120 字元重疊，優先在句尾或空白切割；表格完整保留，可能超過 900 字元。
- 保存頁碼、版面類型、座標、段落標題、原文 startOffset/endOffset、裝置與預覽版本 ID，extraction 為 `mineru-pipeline`。
- 重建先完成解析及結果驗證，再以交易取代該 PDF 的 PdfPages 與 RagDocumentChunks；保留 PDF 原檔，不修改任何 YouTube 逐字稿。
- 沒有可讀文字或解析失敗時不建立假文字，重建時保留既有切塊。新的上傳回應只包含來源摘要，避免資料庫導覽屬性循環序列化。
- 未完成的 migration 不會因 MinerU 容器啟動而自動套用；資料庫仍由 .NET 的既有啟動流程管理。不得回退原有耗時 migration。

## 測試與原始碼

- `services/mineru/`：Dockerfile、固定版本依賴、HTTP server、推論 worker。
- `Rag.Api/Services/PdfLayoutInferenceService.cs`：可取消的 HTTP／ZIP 介面與 GPU 排隊。
- `tests/PdfIngestion.Checks`：只建立及清理隨機測試資料庫，檢查真實解析、外鍵、原文偏移、表格完整性、預覽 PNG 尺寸與文字框、來源隔離及失敗保留。需先啟動 MinerU GPU 容器，並提供單頁掃描測試檔。

```powershell
dotnet build tests/PdfIngestion.Checks -c Release -o "$env:TEMP\ragyt-pdf-ocr-checks"
dotnet "$env:TEMP\ragyt-pdf-ocr-checks\PdfIngestion.Checks.dll" "$PWD" 'C:\測試資料\單頁掃描.pdf'
```

這些檢查不會重新辨識你的整份既有 PDF，也不會重跑轉錄。使用者可在更新 API 後，於切塊視窗確認並按「從原始 PDF 重建切塊」。119 頁文件可能需數分鐘，首次模型下載更久；目前是同步 HTTP 請求，部署代理需配合逾時。

官方參考：[MinerU 專案](https://github.com/opendatalab/MinerU)、[輸出格式](https://opendatalab.github.io/MinerU/reference/output_files/)。整合以固定套件原始碼為準，避免新版 JSON 格式變更造成誤讀。
## 本次驗證（2026-11-15）

Docker GPU 健康檢查、`start-all.bat --check`、真實掃描單頁解析與獨立資料庫整合檢查已通過。該頁產生 8 個版面區塊、13 個文字行框；桌機與手機瀏覽器已檢查框線對齊、點選、縮放及開關。巢狀 PNG／JSON 預覽資產備份與測試還原已通過。原本完整 119 頁 PDF 尚未用 MinerU 重建；更新 API 後可從 UI 的重建按鈕處理。
