# 本機對話與 3D 肌肉選擇

## 頁面與權限

- `/chat`：LLM 對話，User 與 Admin 登入後可使用。
- `/muscles`：3D 人體肌群選擇，User 與 Admin 登入後可使用。
- `/user-rag`：原有 RAG 檢索。選擇肌肉可帶入搜尋字詞，再自行按搜尋。
- `/dashboard`、`/admin-dashboard`：僅 Admin 可存取。導覽也只向 Admin 顯示來源管理。

## Ollama 架構與啟用

`Angular ChatPage → OpenAPI 產生的 ChatService → ASP.NET /api/Chat → 本機 Ollama /api/chat`

1. 安裝 Ollama 後，雙擊 `start-all.bat` 會啟動／沿用本機 Ollama 服務，並在缺少時自動下載 `gemma4:12b`。不需要另外開 `ollama run` 互動視窗。預設位址 `http://localhost:11434`；可透過 `Rag.Api/appsettings.json` 的 `Ollama:BaseUrl` 或環境變數 `Ollama__BaseUrl` 修改。
2. 安裝使用者指定模型：`ollama pull gemma4:12b`。此步會下載模型，需要足夠磁碟與推論資源。
3. 確認 `ollama list` 可見 `gemma4:12b`。
4. 啟動包含 ChatController 的最新版 Rag.Api。若有進行中的逐字稿工作，等它完成再重啟，避免中斷工作。
5. 登入前端，進入「LLM 對話」，重新整理模型清單後送出問題。

啟動器透過 `scripts/setup-ollama.ps1` 先確認 `/api/tags`，本機服務未啟動時以隱藏程序執行 `ollama serve`，模型缺少時才執行 `ollama pull gemma4:12b`。啟動器不預載模型；由對話 API 收到請求後才載入。按 Ctrl+C 仍只停止前景 API，Ollama 會繼續執行。新啟動服務的日誌位於 `%TEMP%\ragyt-startup\ollama.stderr.log`（及 `ollama.stdout.log`）；既有服務沿用原日誌位置。

`start-all.bat --check` 或 `powershell.exe -NoProfile -File scripts/setup-ollama.ps1 -CheckOnly` 只檢查服務與模型，不啟動或下載。Ollama 準備失敗時，啟動器會在停止現有 API 之前中止。

模型清單來自 GET `/api/Chat/models`，不會下載或載入模型。POST `/api/Chat` 傳送模型名稱及歷史訊息，使用 Ollama 的 `stream=false`，等待完整回答。完成後 `keep_alive=0` 釋放模型，避免持續占用顯存；**推論期間仍會與語音辨識、OCR、embedding 共用 GPU**。

目前是一般 LLM 對話，尚未自動串接 RAG 檢索或附加來源引用。歷史僅在登入期間保留於頁面記憶體，不新增資料表，也不存入 localStorage；重新整理、清除對話、切換模型或登出會清除。停止產生、離開頁面及登出會取消前端 HTTP 訂閱，後端將 RequestAborted 傳遞給 Ollama。取消訊號不保證所有 Ollama 版本立即釋放 GPU；可用 `ollama ps` 觀察。

最多 40 則歷史訊息、每則 12000 字元、合計 48000 字元；前端保留一則回答空間。API 最長等待五分鐘，單次生成上限 2048 tokens。失敗或停止時，問題回填輸入框供重試。所有訊息按純文字渲染，不直接插入模型輸出的 HTML。

API 的完整用途、用法、錯誤碼、body 範例可見 Swagger。前端 `libs/api-client/src/services/ChatService.ts` 及 Chat DTOs 由後端 OpenAPI 產生；之後以正常 `npm run generate:api` 更新即可。

## Muscle Atlas 3D 人體模型

3D 頁面依 Startup.blend 補齊並去重，保留六大部位並依解剖身份修正歸屬；目前依 Startup.blend 整理為 466 個肌肉物件、238 個骨骼與 8 個筋膜相關支持結構。提供獨立選取、透明度、0–100% 爆炸圖與繁體中文／英文對照；來源沒有皮膚層。選取的名稱可帶入 LLM 對話或 RAG 搜尋草稿。

模型來源、授權、重建步驟與驗證方式，請見 [人體模型文件](anatomy-model.md)。

## 驗證

後端無資料庫測試：

```powershell
dotnet build tests/Chat.Checks/Chat.Checks.csproj -p:UseAppHost=false -o C:\Temp\ragyt-chat-checks
dotnet C:\Temp\ragyt-chat-checks\Chat.Checks.dll
```

前端建置：`cd frontend; npx nx build frontend --skip-nx-cache`。

`tests/Chat.Checks/check-ui.cjs` 使用 Playwright 與 mock API 驗證 3D 點選、跨頁帶入、對話、取消、錯誤、行動版與登入保護，不使用真實 GPU 推論。必須另用已安裝的模型驗證實際生成品質。

參考：[Ollama chat API](https://docs.ollama.com/api/chat)、[模型清單](https://docs.ollama.com/api/tags)、[Three.js](https://threejs.org/docs/)。





