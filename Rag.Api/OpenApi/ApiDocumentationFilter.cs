using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Rag.Api.OpenApi;

// Changes OpenAPI documentation only; endpoint behavior and authorization are unchanged.
public sealed class ApiDocumentationFilter : IOperationFilter
{
    private sealed record Doc(string Title, string Purpose, string Usage, string Impact, string? Example, string Responses);
    private static readonly Dictionary<string, Doc> Docs = new()
    {
        ["Auth.Register"] = new("註冊一般使用者", "建立 User 角色帳號，不授予 Admin。", "不需登入。送出 email、password，可附 firstName、lastName。密碼至少 8 碼，需大小寫英文字母、數字與特殊字元。", "新增帳號與角色關聯；成功後另呼叫 login。", """{"email":"your-email@example.com","password":"<your-password>","firstName":"測試","lastName":"使用者"}""", "200|帳號建立成功;400|必填缺少、帳號重複或密碼不符規則；查看 errors"),
        ["Auth.Login"] = new("登入取得 JWT", "驗證帳密並取得 accessToken。", "填入自己的 email、password。複製回應 accessToken，在上方 Authorize 貼上 token 本身，不需加 Bearer 前綴。有效期 8 小時。", "不建立新帳號，不執行同步或轉錄。回應含 roles、expiresAt、email、fullName。", """{"email":"your-email@example.com","password":"<your-password>"}""", "200|登入成功，回應 accessToken;401|帳號或密碼不正確"),
        ["Auth.Me"] = new("讀取目前登入者", "查看 JWT 對應帳號與角色。", "先登入並完成 Authorize，再執行 GET。", "唯讀；回應 userId、email、firstName、lastName、roles。", null, "200|登入者資料"),
        ["Auth.AdminDashboard"] = new("驗證 Admin 存取權", "確認 token 具有 Admin 角色。", "用 Admin 帳號登入後執行 GET。", "只回傳確認訊息，不載入管理頁資料。", null, "200|Admin 存取成功"),
        ["Auth.UserDashboard"] = new("驗證 User 存取權", "確認 token 具有 User 角色。", "用具有 User 角色的帳號登入後執行 GET；只有 Admin 不代表具有 User。", "只回傳確認訊息。", null, "200|User 存取成功"),
        ["SourceManagement.GetYoutubeSources"] = new("列出 YouTube 來源", "取得已登錄的影片／頻道來源，依建立時間由新到舊排序。", "GET 後從回應 id 選擇同步、影片清單或逐字稿操作的來源。", "只讀資料庫，不向 YouTube 查詢。", null, "200|來源陣列，無資料時 []"),
        ["SourceManagement.GetYoutubeSource"] = new("查看單一 YouTube 來源", "取得來源網址、名稱與狀態。", "id 填來源資料庫整數 ID，例如 3，不是 YouTube videoId。", "唯讀。", null, "200|來源資料;404|來源不存在"),
        ["SourceManagement.CreateYoutubeSource"] = new("新增 YouTube 來源", "登錄影片或頻道供後續同步。", "name、url 必填；可附 channelId、channelName、description、isActive。成功後用回應 id 呼叫 sync。", "只新增來源，不自動同步或轉錄。", """{"name":"範例頻道","url":"https://www.youtube.com/@your-channel","channelName":"範例頻道","isActive":true}""", "200|新來源，包含 id;400|name 或 url 空白"),
        ["SourceManagement.UpdateYoutubeSource"] = new("更新 YouTube 來源", "修改來源設定。", "指定 id，body 提供要修改的欄位。status：0=Draft、1=Active、2=Paused、3=Error。未提供的欄位通常保留原值。", "不自動同步；改網址後需另呼叫 sync。", """{"name":"更新後的名稱","isActive":true,"status":1}""", "200|更新後來源;404|來源不存在"),
        ["SourceManagement.DeleteYoutubeSource"] = new("刪除 YouTube 來源及逐字稿", "移除整個來源。", "指定 id 後執行 DELETE；先確認來源正確。", "刪除來源與影片清單，並透過關聯刪除逐字稿、片段及逐字稿索引，不是只隱藏來源。", null, "200|刪除成功;404|來源不存在"),
        ["SourceManagement.GetYoutubeVideos"] = new("讀取已同步影片清單（View videos）", "重新開啟已儲存影片。", "指定來源 id。回應 videoId、title、url、availability、durationSeconds；availability 直接保留 yt-dlp 原始值，例如 public、unlisted、subscriber_only、private、premium_only、needs_auth，缺失時為 null。長度單位秒。", "只讀資料庫，不向 YouTube 同步或轉錄。回應 metadataStatus 表示背景補查狀態；開啟管理頁會另行 POST enrich-metadata 排程補查缺漏資訊。", null, "200|影片陣列，未同步時可能為 [];404|來源不存在"),
        ["SourceManagement.EnrichYoutubeMetadata"] = new("背景補查影片原始分類與長度", "開啟 View videos 後自動補查缺少資訊的已同步影片。", "id 為來源 ID；POST 不需 body。回應影片陣列，metadataStatus 為 queued、running、complete、unavailable 或 failed；定期 GET videos 讀取結果。預設最多同時補查 2 支，可設定 Youtube:MetadataWorkers（1～4）。", "僅透過 yt-dlp 讀取資訊並保存到非逐字稿清單 RagDocumentChunks.MetadataJson 的 availability、durationSeconds。相同工作不重複排入；失敗暫停 5 分鐘、仍缺資料暫停 15 分鐘後，下一次開啟清單可重新排程。check-access 可立即手動重試。不下載音訊、不轉錄，不將下載成功推定為 public。", null, "202|已排程並回傳目前影片清單;404|來源不存在"),
        ["SourceManagement.CheckYoutubeVideoAccess"] = new("更新影片資訊與長度", "透過 yt-dlp 補查存取狀態與影片長度，對應「更新影片資訊」。", "id 填來源 ID，videoId 填已同步的 11 字元影片 ID；不需 body。", "取得新資訊時更新 RagDocumentChunks.MetadataJson 的 availability、durationSeconds。保留逐字稿，不下載音訊、不轉錄；受限影片可能無法取得長度。", null, "200|更新後資訊，查無新資訊時可維持原值;400|videoId 格式無效;404|影片不在來源清單;502|YouTube／yt-dlp 查詢失敗或資料無法解析;504|查詢逾時"),
        ["SourceManagement.SyncYoutubeSource"] = new("同步影片／頻道清單（Sync Video／Channel）", "向 YouTube 重新取得影片中繼資料。", "先建立來源。指定 id，mode 填 video 或 channel。video 對應單支影片網址；若來源不是單支影片網址，後端改用 channel。等待 HTTP 回應完成；目前沒有獨立同步進度 API。Take 目前未使用，不限制筆數。", "成功後替換此來源的非逐字稿影片清單，保留相同 videoId 先前已取得但新清單缺失的 availability、durationSeconds，背景補查其餘缺漏。更新來源狀態與時間；保留逐字稿和其索引。不下載音訊、不執行語音辨識。回應 sourceId、syncedChunks、videos、實際 mode。", """{"mode":"channel"}""", "200|同步完成;400|mode 或頻道網址不正確;404|來源不存在;502|YouTube／yt-dlp 查詢失敗;504|同步逾時"),
        ["SourceManagement.GetPdfSources"] = new("列出 PDF 來源", "取得登錄或上傳的 PDF 來源。", "GET 後使用回應 id 操作指定來源。", "只讀資料庫，不下載或解析 PDF。", null, "200|來源陣列"),
        ["SourceManagement.GetPdfSource"] = new("查看單一 PDF 來源", "查看 PDF 名稱、檔名、網址與狀態。", "指定 PDF 來源 id。", "唯讀。", null, "200|PDF 來源;404|來源不存在"),
        ["SourceManagement.CreatePdfSource"] = new("登錄 PDF 網址", "建立 PDF 來源資料。", "name、url 必填，可附 fileName、description、isActive。需要建立搜尋片段時改用 pdf/upload。", "只登錄來源，不下載、解析或建立搜尋索引。", """{"name":"範例文件","fileName":"guide.pdf","url":"https://example.com/guide.pdf","isActive":true}""", "200|新增的 PDF 來源;400|name 或 url 空白"),
        ["SourceManagement.UploadPdf"] = new("上傳 PDF 並建立搜尋片段", "儲存 PDF、擷取內嵌文字並切塊。", "使用 multipart/form-data；填 Name，File 選 .pdf，可附 Description。請求上限 200,000,000 bytes。", "寫入 uploads/pdf、PdfSources、RagDocumentChunks。目前未整合真正的掃描影像 OCR；無內嵌文字時儲存提示片段並設來源 status=Error，HTTP 仍可為 200。回應 source、chunkCount，需檢查 source.status。", null, "200|檔案已處理，請同時檢查來源狀態;400|缺少名稱／檔案或不是 .pdf;413|請求過大，亦可能被代理伺服器拒絕"),
        ["SourceManagement.UpdatePdfSource"] = new("更新 PDF 來源設定", "修改名稱、網址、狀態等欄位。", "指定來源 id，只提供要修改的欄位；status：0=Draft、1=Active、2=Paused、3=Error。", "不重新解析 PDF，不重建已有搜尋片段。", """{"name":"更新後的文件名稱","status":1}""", "200|更新後來源;404|來源不存在"),
        ["SourceManagement.DeletePdfSource"] = new("刪除 PDF 來源紀錄", "移除 PDF 來源資料。", "指定來源 id，執行 DELETE。", "目前僅移除 PdfSources 紀錄，此端點不刪磁碟 PDF，也未清理 RagDocumentChunks。", null, "200|刪除成功;404|來源不存在"),
        ["TranscriptChunks.List"] = new("依版本 ID 管理 RAG 切塊", "讀取指定逐字稿版本的搜尋切塊，供編輯彈窗使用。", "id 填 YouTube 來源 ID，transcriptId 填 YoutubeTranscripts.Id。回應 chunks 包含 RagDocumentChunks.Id、content、時間範圍及唯讀 metadataJson。", "唯讀，不重新切塊或轉錄。歷史版本可以查看，但預設搜尋使用最新版本。isBatchActive=true 時應先停止此來源批次，再編輯或刪除。", null, "200|版本資料與切塊陣列;404|版本不屬於指定來源或不存在"),
        ["TranscriptChunks.Update"] = new("編輯指定版本的一個 RAG 切塊", "修改單一搜尋切塊文字。", "路徑指定來源、版本與 chunkId；body.content 是新文字，originalContent 是查詢時的原始文字，用於避免覆蓋其他人的修改。content 不可空白，最多 20000 字元。", "只更新 RagDocumentChunks.Content；不修改 YoutubeTranscripts、YoutubeTranscriptSegments、時間戳或影片清單。重建搜尋片段會覆蓋手動修改。", """{"content":"修正後的搜尋文字","originalContent":"查詢時取得的原始文字"}""", "200|已更新的切塊 id 和 content;400|內容或原始文字無效;404|來源、版本或切塊關聯不符;409|內容已變更或此來源正在轉錄，請重新載入或先停止批次"),
        ["TranscriptChunks.PreviewDelete"] = new("預覽刪除版本的影響範圍", "確認刪除指定版本會影響哪些資料。", "指定來源與版本，先 GET deletion-preview，再向使用者列出 transcriptCount、segmentCount、chunkCount 與三張表，要求確認版本 ID。保留回應 revision 供 DELETE 使用。", "唯讀，尚未刪除任何資料；revision 是目前版本與切塊快照的指紋，資料變更後需重新取得。remainingVersionCount 是同來源同影片其他版本數量。", null, "200|影響筆數與 revision;404|版本不存在或不屬於此來源"),
        ["TranscriptChunks.DeleteVersion"] = new("刪除已確認的逐字稿版本與 RAG 切塊", "刪除指定版本及其關聯資料。", "必須先取得 deletion-preview、向使用者列出影響並確認。DELETE body.confirmationId 必須等於路徑 transcriptId；expectedRevision 必須是剛確認的 revision。", "在同一交易刪除 RagDocumentChunks、YoutubeTranscriptSegments、YoutubeTranscripts。保留 YoutubeSources、非逐字稿影片清單及其他版本。資料已改變或批次仍在進行則拒絕。刪除最新版本後搜尋可能改用上一版本；後續轉錄可能重新建立已刪除版本的內容。", """{"confirmationId":26,"expectedRevision":"<revision from deletion-preview>"}""", "200|實際刪除筆數;400|版本 ID 未確認或缺少 revision;404|版本不存在或來源不符;409|資料已變更、筆數不符或批次進行中，需停止或重新確認"),
        ["Rag.Search"] = new("搜尋文件與逐字稿片段", "查詢 PostgreSQL 中的片段，目前使用 ILIKE 關鍵字比對，不是向量搜尋或 LLM 回答。", "query 必填，例如 query=臀中肌。可加 sourceType=1（YouTube）或 2（PDF）、sourceId=3、take=20。take 限 1–50；sourceType 和 sourceId 建議一起填。", "唯讀；逐字稿只查最新版本索引。回應 query、篩選條件、count、items；逐字稿結果可含 videoUrl、transcriptId、startSeconds、endSeconds。", null, "200|搜尋結果，無符合資料時 items=[];400|query 空白"),
        ["YoutubeTranscripts.CreateBatch"] = new("建立背景轉錄批次", "將選定影片排入背景佇列。", "id 是來源 ID。videoIds 為非空影片 ID 陣列；language 可省略自動偵測，或填 zh、ja、en。收到回應後輪詢 GET batches/latest。202 只代表已接受，不能當成轉錄完成。", "已有含片段的逐字稿時沿用最新版本。subscriber_only、private、premium_only、needs_auth 會被拒絕；未提供 availability 的影片仍可能處理失敗。佇列及進度只存記憶體，重啟 API 會失去未完成工作與進度；已儲存逐字稿保留。", """{"videoIds":["reO_jZhwsvs"],"language":"zh"}""", "202|新批次已接受;200|同來源已有未完成批次，回傳原批次、不重複排入;400|語言無效、清單空白或含不在同步清單／已知受限影片;404|來源不存在"),
        ["YoutubeTranscripts.CancelBatch"] = new("停止指定的背景轉錄批次", "取消目前來源的指定批次，保留已儲存逐字稿。", "先 GET batches/latest 取得批次 id，經使用者確認後 POST batches/{batchId}/cancel；不需 body。等待此請求完成，回應停止後的快照。", "取消排隊影片及進行中的下載、辨識、翻譯；取消後 videos.state=cancelled，stopRequested=true。已成功儲存的版本和已沿用的版本保留；不會停止其他來源的批次。重複停止同批次為冪等；過期批次 ID 不會影響新批次。", null, "200|指定批次已結束，包含取消結果;409|批次不存在或已被新批次取代，請重新讀取進度"),
        ["YoutubeTranscripts.GetBatch"] = new("查詢最近一次批次進度", "判斷背景轉錄是否仍在執行。", "指定來源 id，定期 GET。active=true 表示尚未完成；finished/total 是完成數量；videos.state 為 queued、running、saved、reused、failed、cancelled，stage 是處理階段，message 是失敗說明。", "唯讀、不建立工作。finished 包含成功、沿用、失敗與取消，全部結束不代表全部成功。只保留目前程序記憶體中的最近批次；重啟後無進度不代表已儲存逐字稿消失。", null, "200|最近批次快照;204|沒有該來源的批次紀錄，null 可能被框架轉為無內容回應"),
        ["YoutubeTranscripts.Create"] = new("單支影片轉錄（等待完成或沿用舊版）", "讀取已有逐字稿，或下載音訊、辨識語音並準備繁中內容。", "指定來源 id；body 填 videoId，可附 language=zh、ja、en。省略 videoId 時從來源單支影片網址推導。新轉錄會持續等待 HTTP 完成，多支影片建議用 batches。", "同來源、同影片已有含片段版本時回傳 reused=true，不重新轉錄。新轉錄會儲存版本、片段與搜尋索引；失敗查看 stage、videoId、message。耗時單位秒。", """{"videoId":"reO_jZhwsvs","language":"zh"}""", "200|沿用既有版本，reused=true;201|新版本已儲存，reused=false;400|影片 ID、語言或同步清單驗證失敗;404|來源不存在;422|下載、辨識、翻譯等轉錄階段失敗"),
        ["YoutubeTranscripts.List"] = new("列出已存逐字稿與耗時", "讀取來源全部逐字稿版本，不含片段內文。", "指定來源 id，回應依版本 id 由新到舊排序。用回應 id 呼叫 GET /{transcriptId} 取得內容。", "唯讀、不轉錄。含 segmentCount 與四種耗時；舊紀錄可能為 null，應顯示「無紀錄」，不是 0 秒。無紀錄或來源不存在時為 []。", null, "200|版本陣列"),
        ["YoutubeTranscripts.Get"] = new("讀取完整逐字稿（彈窗內容）", "取得指定版本的資訊、耗時與全部時間軸片段。", "id 是來源 ID，transcriptId 是版本 ID，例如來源 3、版本 26。segments 依 sequence 排序，startSeconds/endSeconds 是影片時間軸秒數。", "唯讀、不重新下載或轉錄。回應 id、videoId、language、origin、model、engineVersion、createdAt、四種耗時、segments。text 是辨識原文，traditionalChineseText 是繁中翻譯／轉換，可與原文相同。processingSeconds、downloadSeconds、transcriptionSeconds、translationSeconds 是處理耗時，與影片長度不同；舊資料可為 null。", null, "200|完整版本與片段;404|來源與版本組合不存在"),
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var route = context.ApiDescription.ActionDescriptor.RouteValues;
        route.TryGetValue("controller", out var controller);
        route.TryGetValue("action", out var action);
        var auth = context.MethodInfo.DeclaringType!.GetCustomAttributes(true).OfType<AuthorizeAttribute>()
            .Concat(context.MethodInfo.GetCustomAttributes(true).OfType<AuthorizeAttribute>()).ToArray();
        var roles = string.Join(", ", auth.Select(a => a.Roles).Where(r => !string.IsNullOrEmpty(r)));
        if (Docs.TryGetValue($"{controller}.{action}", out var doc))
        {
            operation.Summary = doc.Title;
            operation.Description = $"## 用途\n{doc.Purpose}\n\n## 用法\n{doc.Usage}\n\n## 資料影響與注意事項\n{doc.Impact}\n\n## 權限\n" +
                (auth.Length == 0 ? "不需登入。" : $"需 JWT 登入{(roles.Length == 0 ? "" : $"；角色：{roles}")}。") +
                (doc.Example is null ? "" : $"\n\n## 請求範例（請替換範例中的帳密、網址與 ID）\n```json\n{doc.Example}\n```");
            // Preserve inferred response content while adding explicit status descriptions.
            foreach (var item in doc.Responses.Split(';'))
            {
                var parts = item.Split('|', 2);
                if (!operation.Responses.TryGetValue(parts[0], out var response))
                    operation.Responses[parts[0]] = response = new OpenApiResponse();
                response.Description = parts[1];
            }
            if (doc.Example is not null && operation.RequestBody?.Content.TryGetValue("application/json", out var body) == true)
                body.Example = OpenApiAnyFactory.CreateFromJson(doc.Example);
        }
        foreach (var p in operation.Parameters)
            p.Description ??= p.Name.ToLowerInvariant() switch
            {
                "id" => "來源資料庫整數 ID，例如 3，不是 YouTube videoId。",
                "chunkid" => "RagDocumentChunks.Id，必須屬於路徑指定的逐字稿版本。",
                "batchid" => "從 batches/latest 取得的批次 UUID；舊批次 ID 不會停止新批次。",
                "transcriptid" => "逐字稿版本 ID，必須屬於指定來源。",
                "videoid" => "YouTube 的 11 字元影片 ID，不是完整網址。",
                "query" => "必填關鍵字，以 PostgreSQL ILIKE 文字比對。",
                "sourcetype" => "可省略，1=YouTube、2=PDF。",
                "sourceid" => "可省略，建議和 sourceType 一起指定。",
                "take" => "預設 20，實際限制在 1–50。",
                _ => null
            };
        operation.Security = [];
        if (auth.Length != 0)
        {
            operation.Security.Add(new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
            });
            operation.Responses["401"] = new OpenApiResponse { Description = "缺少、無效或過期的 JWT；先登入再 Authorize。" };
            if (roles.Length != 0)
                operation.Responses["403"] = new OpenApiResponse { Description = $"已登入但缺少必要角色：{roles}。" };
        }
        if (context.ApiDescription.RelativePath == "health")
        {
            operation.Summary = "檢查 API 存活狀態";
            operation.Description = "用途：確認 API 能接受 HTTP 請求。用法：GET /health，回傳 {\"status\":\"ok\"}，不需登入。此端點不代表 YouTube、批次工作或所有外部服務正常。";
        }
    }
}
