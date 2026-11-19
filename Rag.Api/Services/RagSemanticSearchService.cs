using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public sealed class RagSemanticSearchService(ApplicationDbContext db, WeaviateVectorStore store,
    BgeEmbeddingService bge, JinaEmbeddingService jina, IWebHostEnvironment env)
{
    public async Task<IReadOnlyList<object>> SearchAsync(string query, SourceType? type, int? sourceId, int take, bool includeImages, bool hybrid, CancellationToken token)
    {
        var encoded = await bge.EncodeAsync([query], true, token);
        var candidates = await store.SearchAsync(WeaviateVectorStore.TextClass, encoded.Vectors[0], query, (int?)type, sourceId, Math.Clamp(take * 5, 50, 250), hybrid, token);
        // List.Contains avoids .NET 10's span overload in EF Core 8 expression trees.
        var ids = candidates.Select(c => c.Id).ToList();
        var current = RagVectorDocuments.Eligible(db).Where(c => ids.Contains(c.Id));
        if (type.HasValue) current = current.Where(c => c.SourceType == type.Value);
        if (sourceId.HasValue) current = current.Where(c => c.SourceId == sourceId.Value);
        var chunks = await RagVectorDocuments.LoadAsync(db, current, token);
        var byId = chunks.ToDictionary(c => c.Id);
        var hits = new List<(string Key, double Score, object Value)>();
        foreach (var entry in candidates)
        {
            if (!byId.TryGetValue(entry.Id, out var chunk)) continue;
            var d = RagVectorDocuments.Build(chunk);
            if (d.ContentHash != entry.Hash || entry.ModelKey != d.ModelKey) continue;
            var segment = chunk.YoutubeTranscriptSegment;
            var score = 1d / (60 + entry.Rank);
            hits.Add(("text:" + chunk.Id, score, new
            {
                chunk.Id,
                chunk.SourceType,
                chunk.SourceId,
                chunk.SourceName,
                Snippet = d.Content,
                Score = score,
                MatchType = "text",
                Model = "BGE-M3",
                Page = d.Page,
                PdfPageId = chunk.PdfPageId,
                TranscriptId = segment?.YoutubeTranscriptId,
                StartSeconds = segment?.StartSeconds,
                EndSeconds = segment == null ? (double?)null : YoutubeSearchChunks.EndSeconds(chunk),
                VideoUrl = segment == null ? null : $"https://www.youtube.com/watch?v={d.VideoId}&t={(long)segment.StartSeconds}s",
                chunk.CreatedAt
            }));
        }
        if (includeImages && type != SourceType.YouTube)
        {
            var imageQuery = await jina.EncodeQueryAsync(query, token);
            var imageCandidates = await store.SearchAsync(WeaviateVectorStore.ImageClass, imageQuery.Vectors[0], query, 2, sourceId, Math.Clamp(take * 3, 30, 150), false, token);
            // Validate current source, page, asset hash before returning any externally stored candidate.
            var pages = (await RagImageDocuments.LoadAsync(db, env, token)).Where(p => !sourceId.HasValue || p.SourceId == sourceId.Value).ToDictionary(p => p.Id);
            foreach (var entry in imageCandidates)
            {
                if (!pages.TryGetValue(entry.Id, out var page) || page.Hash != entry.Hash || entry.ModelKey != WeaviateVectorStore.JinaKey) continue;
                var score = 1d / (60 + entry.Rank);
                hits.Add(("image:" + page.Id, score, new
                {
                    Id = page.Id,
                    SourceType = SourceType.Pdf,
                    page.SourceId,
                    page.SourceName,
                    Snippet = page.Text,
                    Score = score,
                    MatchType = "image",
                    Model = "Jina CLIP v2",
                    page.Page,
                    PdfPageId = page.Id,
                    PreviewUrl = $"/api/Rag/pdf/{page.SourceId}/pages/{page.Page}/image"
                }));
            }
        }
        // RRF gives equal model rank equal weight; distances from different models are never compared.
        return hits.GroupBy(h => h.Key).Select(g => g.OrderByDescending(h => h.Score).First()).OrderByDescending(h => h.Score).Take(Math.Clamp(take, 1, 50)).Select(h => h.Value).ToArray();
    }
}
