using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rag.Api.DTOs;

namespace Rag.Api.Controllers;

[ApiController, Route("api/[controller]"), Authorize]
public sealed class ChatController(IHttpClientFactory clients, IConfiguration configuration, ILogger<ChatController> logger) : ControllerBase
{
    /// <summary>列出本機 Ollama 已安裝的模型，供登入使用者選擇。</summary>
    /// <remarks>不會下載或載入模型。Ollama 未啟動時回傳 503。位址由後端 Ollama:BaseUrl 設定。</remarks>
    [HttpGet("models")]
    [ProducesResponseType<ChatModelsResponse>(200)]
    public Task<ActionResult<ChatModelsResponse>> Models(CancellationToken token) => Execute(async client =>
    {
        using var response = await client.GetAsync("api/tags", token);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(token), cancellationToken: token);
        var models = json.RootElement.GetProperty("models").EnumerateArray()
            .Select(model => new ChatModel(model.GetProperty("name").GetString() ?? ""))
            .Where(model => model.Name.Length > 0).ToArray();
        return new ChatModelsResponse(models);
    }, token);

    /// <summary>將對話歷史交給本機 Ollama，回傳一則完整回答。</summary>
    /// <remarks>先 GET models 選取已安裝模型，再傳 model 與 messages（user/assistant）。最後一則須為 user；最多 40 則、合計 48000 字元。使用 stream=false；取消 HTTP 請求會傳遞取消訊號給 Ollama。不寫入資料庫、不自動檢索 RAG；歷史由前端隨請求傳送。</remarks>
    [HttpPost]
    [ProducesResponseType<ChatResponse>(200)]
    public Task<ActionResult<ChatResponse>> Send(ChatRequest request, CancellationToken token)
    {
        if (request.Messages.Count == 0 || request.Messages.Any(m => m is null || string.IsNullOrWhiteSpace(m.Content)) ||
            request.Messages.Sum(m => m.Content.Length) > 48000 || request.Messages[^1].Role != "user")
            return Task.FromResult<ActionResult<ChatResponse>>(BadRequest(new { message = "對話不可空白，最後一則須為 user，且總長度不得超過 48000 字元。" }));
        return Execute(async client =>
        {
            using var response = await client.PostAsJsonAsync("api/chat", new
            {
                model = request.Model,
                messages = request.Messages.Select(m => new { role = m.Role, content = m.Content }),
                stream = false,
                keep_alive = "0",
                options = new { num_predict = 2048 },
            }, token);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                throw new HttpRequestException("Model unavailable", null, System.Net.HttpStatusCode.NotFound);
            response.EnsureSuccessStatusCode();
            var answer = await response.Content.ReadFromJsonAsync<OllamaAnswer>(cancellationToken: token);
            if (string.IsNullOrWhiteSpace(answer?.Message?.Content)) throw new JsonException("Empty assistant response");
            return new ChatResponse(answer.Model ?? request.Model, answer.Message.Content);
        }, token);
    }

    private async Task<ActionResult<T>> Execute<T>(Func<HttpClient, Task<T>> action, CancellationToken token)
    {
        try
        {
            using var client = clients.CreateClient("Ollama");
            client.BaseAddress = new Uri((configuration["Ollama:BaseUrl"] ?? "http://localhost:11434").TrimEnd('/') + "/");
            return Ok(await action(client));
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        { return StatusCode(504, new { message = "Ollama 回應逾時，請改用較小模型或稍後再試。" }); }
        catch (Exception error) when (error is HttpRequestException or JsonException)
        {
            logger.LogWarning(error, "Ollama request failed");
            if (error is HttpRequestException { StatusCode: System.Net.HttpStatusCode.NotFound })
                return NotFound(new { message = "Ollama 找不到此模型，請重新整理模型清單。" });
            return StatusCode(503, new { message = "無法連線至本機 Ollama。請啟動 Ollama，並確認已安裝對話模型。" });
        }
    }

    private sealed record OllamaAnswer([property: JsonPropertyName("model")] string? Model, [property: JsonPropertyName("message")] OllamaMessage? Message);
    private sealed record OllamaMessage([property: JsonPropertyName("content")] string? Content);
}
