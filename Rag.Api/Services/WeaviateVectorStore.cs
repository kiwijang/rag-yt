using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Rag.Api.Services;

/// <summary>Two independent, externally vectorized collections. PostgreSQL remains authoritative.</summary>
public sealed class WeaviateVectorStore(IHttpClientFactory clients, IConfiguration config)
{
    public const string TextClass = "RagBgeM3V1";
    public const string ImageClass = "RagJinaClipV2V1";
    public const string JinaRevision = "e10d47f5691d0454a0fb5d13f46f2199b74cb436";
    public const string JinaKey = "jina-clip-v2:" + JinaRevision + ":page-v1:1024";
    private HttpClient Client() { var client = clients.CreateClient("Weaviate"); client.BaseAddress = new Uri((config["Weaviate:Url"] ?? "http://127.0.0.1:8080").TrimEnd('/') + "/"); return client; }
    public static string ObjectId(string collection, int id) => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(collection + ":" + id))[..16]).ToString();
    public static string RevisionId(int id, string hash) => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(TextClass + ":" + id + ":" + hash))[..16]).ToString();
    public async Task EnsureAsync(string collection, CancellationToken token)
    {
        using var client = Client();
        using var existing = await client.GetAsync("v1/schema/" + collection, token);
        if (existing.IsSuccessStatusCode) return;
        if (existing.StatusCode != HttpStatusCode.NotFound) existing.EnsureSuccessStatusCode();
        var properties = new List<object>();
        foreach (var name in new[] { "entityId", "sourceType", "sourceId", "page" }) properties.Add(new { name, dataType = new[] { "int" } });
        foreach (var name in new[] { "contentHash", "modelKey" }) properties.Add(new { name, dataType = new[] { "text" }, tokenization = "field" });
        properties.Add(new { name = "content", dataType = new[] { "text" }, tokenization = "gse" });
        using var result = await client.PostAsJsonAsync("v1/schema", new
        {
            @class = collection,
            vectorizer = "none",
            properties,
            vectorIndexConfig = new { distance = "cosine" }
        }, token);
        result.EnsureSuccessStatusCode();
    }
    public async Task<Dictionary<int, VectorEntry>> ListAsync(string collection, CancellationToken token)
    {
        return (await EntriesAsync(collection, token)).GroupBy(e => e.Id).ToDictionary(g => g.Key, g => new VectorEntry(g.Key, g.Last().Hash, g.Last().ModelKey, 0));
    }
    public async Task<List<StoredVector>> EntriesAsync(string collection, CancellationToken token)
    {
        using var client = Client();
        var result = new List<StoredVector>(); string? after = null;
        while (true)
        {
            using var response = await client.GetAsync($"v1/objects?class={collection}&limit=500" + (after == null ? "" : "&after=" + after), token);
            response.EnsureSuccessStatusCode();
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(token), cancellationToken: token);
            var objects = json.RootElement.GetProperty("objects");
            if (objects.GetArrayLength() == 0) break;
            foreach (var item in objects.EnumerateArray())
            {
                var p = item.GetProperty("properties"); var id = p.GetProperty("entityId").GetInt32();
                result.Add(new(id, p.GetProperty("sourceType").GetInt32(), p.GetProperty("sourceId").GetInt32(),
                    p.GetProperty("contentHash").GetString()!, p.GetProperty("modelKey").GetString()!, item.GetProperty("id").GetString()!));
                after = item.GetProperty("id").GetString();
            }
        }
        return result;
    }
    public async Task UpsertAsync(string collection, int id, int sourceType, int sourceId, int? page, string content, string hash, string key, float[] vector, CancellationToken token, string? objectId = null)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("v1/batch/objects", new
        {
            objects = new[]{new {
            @class=collection,id=objectId??ObjectId(collection,id),vector,properties=new {entityId=id,sourceType,sourceId,page=page??0,content,contentHash=hash,modelKey=key}}}
        }, token);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(token), cancellationToken: token);
        foreach (var item in json.RootElement.EnumerateArray())
            if (item.GetProperty("result").TryGetProperty("errors", out var errors) && errors.ValueKind != JsonValueKind.Null)
                throw new VectorServiceException("Weaviate rejected an indexed object: " + errors);
    }
    public async Task DeleteAsync(string collection, int id, CancellationToken token)
    {
        using var client = Client(); using var response = await client.DeleteAsync($"v1/objects/{collection}/{ObjectId(collection, id)}", token);
        if (response.StatusCode != HttpStatusCode.NotFound) response.EnsureSuccessStatusCode();
    }
    public async Task DeleteObjectAsync(string collection, string objectId, CancellationToken token)
    {
        using var client = Client(); using var response = await client.DeleteAsync($"v1/objects/{collection}/{objectId}", token);
        if (response.StatusCode != HttpStatusCode.NotFound) response.EnsureSuccessStatusCode();
    }
    public async Task PruneTextAsync(Dictionary<int, string> current, int? sourceType, int? sourceId, int? transcriptId, HashSet<int>? transcriptChunkIds, CancellationToken token)
    {
        var entries = await EntriesAsync(TextClass, token);
        foreach (var group in entries.Where(e => (!sourceType.HasValue || e.SourceType == sourceType) && (!sourceId.HasValue || e.SourceId == sourceId) &&
            (!transcriptId.HasValue || transcriptChunkIds!.Contains(e.Id))).GroupBy(e => e.Id))
        {
            var keep = current.TryGetValue(group.Key, out var hash) ? group.Where(e => e.Hash == hash && e.ModelKey is RagVectorDocuments.ModelKey or RagVectorDocuments.OriginalTranscriptModelKey)
                .OrderByDescending(e => e.ObjectId == RevisionId(e.Id, hash)).FirstOrDefault() : null;
            foreach (var entry in group.Where(e => e.ObjectId != keep?.ObjectId)) await DeleteObjectAsync(TextClass, entry.ObjectId, token);
        }
    }
    public async Task<VectorEntry[]> SearchAsync(string collection, float[] vector, string query, int? sourceType, int? sourceId, int take, bool hybrid, CancellationToken token)
    {
        var operands = new List<string>();
        if (sourceType.HasValue) operands.Add($"{{path:[\"sourceType\"],operator:Equal,valueInt:{sourceType.Value}}}");
        if (sourceId.HasValue) operands.Add($"{{path:[\"sourceId\"],operator:Equal,valueInt:{sourceId.Value}}}");
        var filter = operands.Count == 0 ? "" : ",where:" + (operands.Count == 1 ? operands[0] : "{operator:And,operands:[" + string.Join(',', operands) + "]}");
        var vec = JsonSerializer.Serialize(vector);
        var search = hybrid ? $"hybrid:{{query:{JsonSerializer.Serialize(query)},vector:{vec},alpha:0.7,fusionType:relativeScoreFusion}}" : $"nearVector:{{vector:{vec}}}";
        using var client = Client();
        using var response = await client.PostAsJsonAsync("v1/graphql", new { query = $"{{Get{{{collection}({search},limit:{take}{filter}){{entityId contentHash modelKey _additional{{id}}}}}}}}" }, token);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(token), cancellationToken: token);
        if (json.RootElement.TryGetProperty("errors", out _)) throw new VectorServiceException("Weaviate search failed; check collection/model configuration.");
        return json.RootElement.GetProperty("data").GetProperty("Get").GetProperty(collection).EnumerateArray().Select((p, index) =>
            new VectorEntry(p.GetProperty("entityId").GetInt32(), p.GetProperty("contentHash").GetString()!, p.GetProperty("modelKey").GetString()!, index + 1)).ToArray();
    }
}
public sealed record VectorEntry(int Id, string Hash, string ModelKey, int Rank);
public sealed record StoredVector(int Id, int SourceType, int SourceId, string Hash, string ModelKey, string ObjectId);
