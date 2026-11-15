using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Rag.Api.OpenApi;

public sealed class RequestDocumentationFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        foreach (var (name, property) in schema.Properties)
        {
            property.Description = name.ToLowerInvariant() switch
            {
                "content" => "修改後的 RAG 切塊文字，不可空白，最多 20000 字元。只更新搜尋內容，不改原始逐字稿。",
                "originalcontent" => "載入切塊時的原始 content；若資料已被修改，後端回傳 409，避免覆蓋。",
                "confirmationid" => "使用者確認的 YoutubeTranscripts.Id，必須與路徑 transcriptId 一致。",
                "expectedrevision" => "GET deletion-preview 回應的 revision；資料已變更時需重新預覽及確認。",
                "email" => "登入／註冊電子郵件；範例為佔位文字，請換成自己的帳號。",
                "password" => "登入或註冊密碼，請自行填寫；不會在文件中提供真實密碼。",
                "firstname" => "使用者名字。",
                "lastname" => "使用者姓氏。",
                "name" => "來源顯示名稱；建立來源與上傳 PDF 時必填。",
                "channelid" => "YouTube 頻道 ID（UC 開頭）；不是影片 ID。",
                "channelname" => "頻道顯示名稱。",
                "url" => "來源網址：YouTube 影片／頻道網址，或 PDF 網址。登錄網址不會自動執行同步或解析。",
                "thumbnailurl" => "可選縮圖網址。",
                "description" => "可選來源說明。",
                "isactive" => "是否啟用來源；不是觸發同步或轉錄的指令。新增時預設 true。",
                "status" => "來源狀態：0=Draft、1=Active、2=Paused、3=Error。",
                "filename" => "登錄 PDF 的檔名；實際檔案上傳請用 pdf/upload。",
                "file" => "要上傳的 PDF 二進位檔，使用 multipart/form-data，副檔名須為 .pdf。",
                "mode" => "video=單支影片、channel=頻道。若 video 模式搭配非單支影片網址，實際改用 channel。",
                "language" => "可省略或 null，自動偵測；指定時僅接受 zh（中文）、ja（日文）、en（英文）。",
                "videoid" => "11 字元 YouTube 影片 ID。單支轉錄省略此值時，從來源網址推導。",
                "videoids" => "要加入批次的影片 ID 陣列，不可為空；每支須在來源已同步清單內且不是已知受限影片。重複 ID 會去重。",
                "query" => "必填搜尋關鍵字。",
                "sourcetype" => "可省略，1=YouTube、2=PDF。",
                "sourceid" => "可省略的來源 ID，建議與 sourceType 一起指定。",
                "take" when context.Type.Name == "SyncYoutubeSourceRequest" => "目前未使用；預設值 10 不會限制同步影片筆數。",
                "take" => "預設 20，後端限制為 1–50。",
                _ => property.Description
            };
            if (name.Equals("password", StringComparison.OrdinalIgnoreCase))
            {
                property.Format = "password";
                property.WriteOnly = true;
            }
        }
    }
}
