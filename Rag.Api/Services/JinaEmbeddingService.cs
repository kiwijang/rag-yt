using System.Net.Http.Json;

namespace Rag.Api.Services;

public sealed class JinaEmbeddingService(IHttpClientFactory clients, IConfiguration config, GpuInferenceService gpu)
{
    public Task<EmbeddingResult> EncodeQueryAsync(string text, CancellationToken token) => SendAsync(new { id = Guid.NewGuid().ToString("N"), texts = new[] { text }, model = "jina-clip-v2", device = "cpu" }, null, token);
    public Task<EmbeddingResult> EncodeImagesAsync(string[] paths, CancellationToken token) =>
        gpu.WithExternalInferenceAsync(() => SendAsync(null, paths, token), token);
    private async Task<EmbeddingResult> SendAsync(object? body, string[]? paths, CancellationToken token)
    {
        using var client = clients.CreateClient("Embeddings");
        var url = (config["Embeddings:ServiceUrl"] ?? "http://127.0.0.1:8091").TrimEnd('/');
        using var content = new MultipartFormDataContent();
        if (paths != null)
        {
            content.Add(new StringContent(config["Embeddings:IndexDevice"] ?? "auto"), "device");
            foreach (var path in paths) content.Add(new StreamContent(File.OpenRead(path)), "files", Path.GetFileName(path));
        }
        using var response = paths == null ? await client.PostAsJsonAsync(url + "/embed", body, token) : await client.PostAsync(url + "/embed-images", content, token);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<EmbeddingResult>(cancellationToken: token) ?? throw new VectorServiceException("Empty Jina response.");
        if (result.Model != "jinaai/jina-clip-v2" || result.Revision != WeaviateVectorStore.JinaRevision || result.Dimensions != 1024 ||
            result.Vectors.Length != (paths?.Length ?? 1) || result.Vectors.Any(v => v.Length != 1024 || v.Any(x => !float.IsFinite(x))))
            throw new VectorServiceException("Jina model/revision/dimensions mismatch.");
        return result;
    }
}
