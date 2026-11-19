using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public static partial class RagVectorDocuments
{
    public const string Model = "BAAI/bge-m3";
    public const string Revision = "5617a9f61b028005a4858fdac845db406aefb181";
    public const string ModelKey = "bge-m3:5617a9f61b028005a4858fdac845db406aefb181:text-v1:1024";
    public const string OriginalTranscriptModelKey = "bge-m3:5617a9f61b028005a4858fdac845db406aefb181:transcript-original-v2:1024";
    public const int Dimensions = 1024;

    public static IQueryable<RagDocumentChunk> Eligible(ApplicationDbContext db) => db.RagDocumentChunks.AsNoTracking()
        .Where(chunk => (chunk.SourceType == SourceType.Pdf && chunk.PdfSourceId != null &&
            db.PdfSources.Any(source => source.Id == chunk.PdfSourceId && source.IsActive)) ||
            (chunk.SourceType == SourceType.YouTube && chunk.YoutubeTranscriptSegment != null &&
            db.YoutubeSources.Any(source => source.Id == chunk.SourceId && source.IsActive) &&
            !db.YoutubeTranscripts.Any(version => version.YoutubeSourceId == chunk.SourceId &&
                version.VideoId == chunk.YoutubeTranscriptSegment.YoutubeTranscript.VideoId &&
                version.Id > chunk.YoutubeTranscriptSegment.YoutubeTranscriptId)));

    public static IQueryable<RagDocumentChunk> WithTranscript(IQueryable<RagDocumentChunk> query) => query
        .Include(chunk => chunk.YoutubeTranscriptSegment).ThenInclude(segment => segment!.YoutubeTranscript);

    public static async Task<List<RagDocumentChunk>> LoadAsync(ApplicationDbContext db, IQueryable<RagDocumentChunk> query, CancellationToken token)
    {
        var chunks = await WithTranscript(query).ToListAsync(token);
        var ids = chunks.Select(c => c.YoutubeTranscriptSegment?.YoutubeTranscriptId).OfType<int>().Distinct().ToList();
        if (ids.Count == 0) return chunks;
        // One shared segment set per version avoids a large chunk-by-segment Include join.
        var segments = await db.YoutubeTranscriptSegments.AsNoTracking().Where(s => ids.Contains(s.YoutubeTranscriptId)).OrderBy(s => s.Sequence).ToListAsync(token);
        var groups = segments.GroupBy(s => s.YoutubeTranscriptId).ToDictionary(g => g.Key, g => g.ToList());
        foreach (var chunk in chunks)
            if (chunk.YoutubeTranscriptSegment is { } first && groups.TryGetValue(first.YoutubeTranscriptId, out var values)) first.YoutubeTranscript.Segments = values;
        return chunks;
    }

    public static VectorDocument Build(RagDocumentChunk chunk)
    {
        string title = "";
        int? page = null;
        if (!string.IsNullOrWhiteSpace(chunk.MetadataJson))
        {
            using var json = JsonDocument.Parse(chunk.MetadataJson);
            if (json.RootElement.TryGetProperty("sectionTitle", out var value) && value.ValueKind == JsonValueKind.String) title = value.GetString() ?? "";
            if (json.RootElement.TryGetProperty("page", out value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) page = number;
        }
        var content = Clean(chunk.SourceType == SourceType.YouTube ? TranscriptEmbeddingText.Read(chunk) : chunk.Content);
        var modelKey = chunk.SourceType == SourceType.YouTube ? OriginalTranscriptModelKey : ModelKey;
        var input = string.Join("\n", new[] { chunk.SourceName, title, content }.Where(value => !string.IsNullOrWhiteSpace(value)));
        var transcript = chunk.YoutubeTranscriptSegment?.YoutubeTranscript;
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"{modelKey}|{chunk.SourceType}|{chunk.SourceId}|{page}|{transcript?.Id}|{input}")));
        return new(chunk.Id, (int)chunk.SourceType, chunk.SourceId, chunk.SourceName, content, input, hash, title, page,
            transcript?.Id, transcript?.VideoId, modelKey);
    }

    public static string Clean(string text) => Whitespace().Replace(WebUtility.HtmlDecode(HtmlTags().Replace(text, " "))
        .Normalize(NormalizationForm.FormKC), " ").Trim();
    [GeneratedRegex("<[^>]+>", RegexOptions.Singleline)] private static partial Regex HtmlTags();
    [GeneratedRegex(@"\s+")] private static partial Regex Whitespace();
}

public sealed record VectorDocument(int Id, int SourceType, int SourceId, string SourceName, string Content,
    string Input, string ContentHash, string Title, int? Page, int? TranscriptId, string? VideoId, string ModelKey = RagVectorDocuments.ModelKey);
