# RAG YouTube + PDF + IdentityServer

This workspace contains a full-stack starter for a RAG system with:

- Angular frontend
- ASP.NET Core backend
- Duende IdentityServer + ASP.NET Core Identity
- PostgreSQL for relational data
- Weaviate for vector search
- PDF OCR/data ingestion and YouTube source management skeletons

## Stack

- Frontend: Angular 18+
- Backend: ASP.NET Core Web API (net10.0)
- Auth: Duende IdentityServer + ASP.NET Core Identity
- Database: PostgreSQL
- Vector DB: Weaviate

## Windows one-click startup

Start Docker Desktop, then double-click `start-all.bat` in the repository root,
or run it from a terminal:

```cmd
start-all.bat
```

The launcher requires the .NET SDK, Node.js/npm, `frontend/node_modules`, and the
existing `.venv` GPU inference dependencies, plus standalone `yt-dlp` and `ffmpeg` on PATH. It starts all Docker Compose services and
Angular in the background, then builds and runs Rag.Api with the `http` launch
profile in the launcher window. The API uses `.venv/Scripts/python.exe`; separate
Python activation and a second `dotnet run` are unnecessary.

**Press Ctrl+C in the launcher window to stop the backend API.** Docker and Angular
keep running. API output appears directly in that window; Angular logs are saved
to `%TEMP%\ragyt-startup`. Open http://localhost:4200 after the API reports that it
is listening on port 5085.

An existing Angular service is reused. If this project's API already occupies
port 5085, the launcher stops it and its workers, then builds and starts a fresh
foreground API. An in-progress transcription is interrupted by this restart;
previously saved transcripts remain in the database. Another program occupying
5085 is left running and reported as an error. Press Ctrl+C to stop the new API.
Every new API launch builds the current source code.
The launcher does not submit transcription requests, reset the database, or
remove Docker volumes.

Run `start-all.bat --check` to check prerequisites and page readiness without
starting services. If startup fails, inspect the displayed error and Angular log
files; Docker and Angular services that already started remain running.

## Run services

```bash
docker compose up -d
```

## Backend

```bash
cd Rag.Api
dotnet restore
dotnet ef database update
# or just run the app

dotnet run
```

## Frontend

```bash
cd frontend
npm install
npm run start
```

## Transcribe and translate a YouTube video

Install CPython 3.12, Node.js 22 or later, standalone yt-dlp and FFmpeg.
The Development profile targets an NVIDIA GPU (verified on RTX 3060 12 GB):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Rag.Api/Scripts/requirements-gpu.txt
$env:Transcription__PythonExecutable = (Resolve-Path .venv/Scripts/python.exe).Path
.\.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
.\start-all.bat
```

The GPU requirements select the official PyTorch CUDA 12.8 wheel; no system CUDA
upgrade is needed. On Windows the inference worker loads CUDA 12/cuDNN 9 libraries
from `torch/lib`, avoiding an older CUDA toolkit on PATH. Missing GPU support
produces an explicit setup error instead of silently falling back to CPU.

`appsettings.Development.json` sets Whisper `large-v2`, `Device=cuda`,
`ComputeType=float16`, `TranslationDevice=cuda`, `TranslationBatchSize=8`,
`ParallelVideos=1`. Environment variables override these settings, for example
`Transcription__CpuThreads=4` or `Transcription__JsRuntime=node:C:\path\to\node.exe`.
To use CPU explicitly, set `Transcription__Device=cpu`,
`Transcription__ComputeType=int8`, and `Transcription__TranslationDevice=cpu`.
The generic non-Development fallback remains CPU.

C# services own the pipeline:

- `YoutubeMediaService`: standalone yt-dlp metadata/audio download, FFmpeg conversion
  to mono 16 kHz PCM16 WAV, process timeouts and cancellation. Override tool paths
  with `Transcription__YtDlpExecutable` and `Transcription__FfmpegExecutable`.
- `GpuInferenceService`: starts one private Python worker lazily, sends local audio
  paths using JSON-lines over stdin/stdout, forwards stages and logs device/model
  load counters. It serializes GPU requests and reuses the loaded Whisper and NLLB
  models across videos. Models stay in VRAM until the worker/API stops. Cancellation,
  errors or timeouts discard the worker so the next request starts a clean one.
- `YoutubeTranscriptionService`: owns temporary files, stage timing and database writes.
- `inference_worker.py`: inference only; faster-whisper speech recognition, NLLB
  translation, OpenCC conversion. It does not download videos or access the database.

NLLB uses the pinned `facebook/nllb-200-distilled-600M` checkpoint. The loader
restores the checkpoint's real shared embedding alias when Transformers leaves
it on the meta device, and rejects any remaining unloaded parameters. Japanese
and English are translated to `zho_Hant`; Chinese only uses OpenCC on CPU.
The API applies migrations at startup but does not enqueue any transcription
until explicitly requested. First inference may download models; later videos
reuse their in-memory models.

In the admin dashboard, add a single video URL, a YouTube channel URL (including an @handle),
or a source with its UC channel ID. Click **Sync Video** to display the video or list all public
uploads exposed by YouTube through yt-dlp, including Shorts and archived live streams. Channel
sync uses the standalone yt-dlp executable through the C# media service.
Use **View videos** to reopen the last saved list. Choose the spoken language above the list
(Japanese, Chinese, English, or automatic detection), then click **Transcripts** to process
every listed video sequentially. Use **View saved transcripts** to load existing versions.
The list uses yt-dlp availability metadata to label free, channel members-only, and other
restricted videos. Missing metadata is shown as unconfirmed and can be checked per video.
**Transcripts** processes the current filtered list, reuses the newest saved transcript with
segments for each video within the source, and skips videos with known access restrictions.
The video list shows the duration returned by yt-dlp and timings from the latest transcript version.
Use **停止語音辨識** to stop the current source's batch. A confirmation dialog
appears first; **繼續辨識** or Escape leaves it running. **確定停止** cancels queued
videos and the current download/inference, while preserving already saved versions.
Progress marks cancelled videos separately from failures. The stop request includes
the batch UUID so an old dialog cannot cancel a newer batch.

The API queues the batch in the background. You can leave or refresh the Angular page,
then reopen the source with **View videos** to see progress. Queue state is held in the API
process. After an API restart, submit the batch again to reuse saved transcripts and process
unfinished videos.

The Development profile processes one video at a time. `ParallelVideos` controls
batch queue consumers (and potentially concurrent downloads), while the shared
inference service always allows one GPU inference request at a time to avoid
multiple copies of the models. `CpuThreads` defaults to 4 for each native engine.

For each video the server downloads audio with yt-dlp, transcribes it with faster-whisper,
and translates Japanese or English with the local NLLB-200 distilled 600M research model
(CC BY-NC 4.0). Chinese text is converted to Taiwan Traditional Chinese with OpenCC.
Each video has a 30-minute process limit. The server clears temporary audio after processing.
No YouTube Data API key is needed.

Each successful run records server processing time through transcript preparation, before database
writes, plus audio download/FFmpeg preparation, Whisper model loading and recognition, and Traditional Chinese
translation or conversion times. Initial model downloads count toward their respective stages.
The dashboard shows the server's elapsed batch time, including queue time and failed videos.
Earlier transcript versions have no recorded timing.

Each successful run creates a version in `YoutubeTranscripts`, with original and Traditional
Chinese text sharing timestamps in `YoutubeTranscriptSegments`. Open any saved version
in the dashboard. Search indexes both texts from the latest version and returns timestamped
YouTube links. Syncing video or channel metadata preserves transcript versions. Deleting the
source removes its transcripts.

## Manage a transcript version's RAG chunks

In a source's video panel, choose **管理 RAG 切塊** beside a Version button. It automatically loads that `YoutubeTranscripts.Id`. You can also change the ID in the dialog
(the version ID, not the source ID or video ID), then load another version.
Saving a chunk updates only `RagDocumentChunks.Content`. Original transcript
segments, timestamps and metadata stay unchanged. Rebuilding search chunks will
overwrite manual content edits. Editing an older version does not change which
version the default search uses.

**刪除此版本及相關資料** first loads a read-only deletion preview listing the tables
and exact counts. Type the version ID in the confirmation dialog to enable the
final delete button. This deletes that version from `YoutubeTranscripts`, its
`YoutubeTranscriptSegments`, and linked `RagDocumentChunks` in one transaction.
`YoutubeSources`, non-transcript video listing chunks and other versions remain.
Deleting the latest version can expose an older version in search results.

Admin authentication is required. Source/version/chunk ownership is checked by
the backend. Active source batches block edits/deletion; stop the batch and reload
first. Stale chunk edits return 409, and a changed deletion preview must be reviewed
again. There are no database schema changes for this feature.

## Default admin account

- Email: admin@ragyt.local
- Password: Admin123!

## Default user account

- Email: user@ragyt.local
- Password: User123!

## API example

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/admin-dashboard
- GET /api/auth/user-dashboard
- GET /api/sources

## Notes

This starter is designed for local development and extension. For production, add HTTPS certs, secret management, a real OCR provider, and actual YouTube MCP integration.

### 影片分類與長度補查

`View videos` 會讀取資料庫清單，並呼叫 `POST /api/SourceManagement/youtube/{id}/videos/enrich-metadata` 背景補查缺少的原始分類與影片長度；畫面每 5 秒更新結果。預設最多同時補查 2 支影片（`Youtube:MetadataWorkers` 可設 1～4），不下載音訊或啟動語音辨識。查不到資料時仍顯示「未提供」，不以可下載推定為公開。

補查與音訊下載取得的 yt-dlp 原始資訊會保存至非逐字稿清單的 `RagDocumentChunks.MetadataJson`（`availability`、`durationSeconds`）。再次同步頻道時，新清單缺少這些欄位會保留原有資訊，避免重置。既有逐字稿及其 RAG 切塊不變。補查失敗的按鈕改為「重試補查影片資訊」，可立即重試；背景工作則有 5 分鐘失敗／15 分鐘未提供的冷卻時間，避免每次刷新重複查詢。

## 資料備份與還原

本機備份、驗證還原、原理架構與操作步驟請見 [備份與還原說明](docs/backup-and-recovery.md)。

執行：`powershell.exe -NoProfile -File .\scripts\backup\Backup-And-Verify.ps1`。目前尚未啟用排程、異地副本或自動清理。
