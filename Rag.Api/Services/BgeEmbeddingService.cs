using System.Net.Http.Json;
using System.Text.Json;

namespace Rag.Api.Services;

public sealed class BgeEmbeddingService(IHttpClientFactory clients, IConfiguration config,
    GpuInferenceService gpu, IHostApplicationLifetime lifetime, ILogger<BgeEmbeddingService> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public async Task<EmbeddingResult> EncodeAsync(string[] texts, bool query, CancellationToken token)
    {
        if (texts.Length is < 1 or > 64 || texts.Any(text => string.IsNullOrWhiteSpace(text) || text.Length > 200000))
            throw new VectorServiceException("Embedding text batch is empty or exceeds its limits.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.ApplicationStopping);
        timeout.CancelAfter(TimeSpan.FromMinutes(15));
        var device = config[query ? "Embeddings:QueryDevice" : "Embeddings:IndexDevice"] ?? (query ? "cpu" : "auto");
        try
        {
            return device == "cpu" ? await RequestAsync(texts, device, timeout.Token) :
                await gpu.WithExternalInferenceAsync(() => RequestAsync(texts, device, timeout.Token), timeout.Token);
        }
        catch (Exception error) when (error is HttpRequestException or JsonException)
        {
            logger.LogWarning(error, "BGE-M3 service failed");
            throw new VectorServiceException("Embedding service unavailable. Check docker compose logs embedding.", error);
        }
    }
    private async Task<EmbeddingResult> RequestAsync(string[] texts, string device, CancellationToken token)
    {
        using var client = clients.CreateClient("Embeddings");
        var url = (config["Embeddings:ServiceUrl"] ?? "http://127.0.0.1:8091").TrimEnd('/');
        using var response = await client.PostAsJsonAsync(url + "/embed", new { id = Guid.NewGuid().ToString("N"), texts, device }, token);
        if (!response.IsSuccessStatusCode) throw new VectorServiceException($"Embedding service returned HTTP {(int)response.StatusCode}. Check its container logs.");
        var result = await response.Content.ReadFromJsonAsync<EmbeddingResult>(Json, token)
            ?? throw new VectorServiceException("Embedding service returned no result.");
        if (result.Model != RagVectorDocuments.Model || result.Revision != RagVectorDocuments.Revision ||
            result.Dimensions != RagVectorDocuments.Dimensions || result.Vectors.Length != texts.Length ||
            result.TokenCounts.Length != texts.Length || result.WindowCounts.Length != texts.Length ||
            result.Vectors.Any(vector => vector.Length != RagVectorDocuments.Dimensions || vector.Any(value => !float.IsFinite(value))))
            throw new VectorServiceException("Embedding model, revision or dimensions do not match this index.");
        return result;
    }
}
public sealed record EmbeddingResult(string Model, string Revision, int Dimensions, string Device, float[][] Vectors, int[] TokenCounts, int[] WindowCounts);
public sealed class VectorServiceException(string message, Exception? inner = null) : Exception(message, inner);
