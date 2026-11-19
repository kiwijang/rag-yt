using Rag.Api.Data;
using Rag.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Rag.Api.Services;

public class RagSearchService
{
    private readonly ApplicationDbContext _db;

    public RagSearchService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<object>> SearchAsync(string query, SourceType? sourceType, int? sourceId, int take, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return [];

        take = Math.Clamp(take, 1, 50);

        var q = RagVectorDocuments.Eligible(_db);

        if (sourceType.HasValue)
        {
            q = q.Where(x => x.SourceType == sourceType.Value);
        }

        if (sourceId.HasValue)
        {
            q = q.Where(x => x.SourceId == sourceId.Value);
        }

        q = q.Where(x => EF.Functions.ILike(x.Content, $"%{query}%"));
        q = q.Where(x => x.YoutubeTranscriptSegmentId == null ||
            !_db.YoutubeTranscripts.Any(transcript =>
                transcript.YoutubeSourceId == x.SourceId &&
                transcript.VideoId == x.YoutubeTranscriptSegment!.YoutubeTranscript.VideoId &&
                transcript.Id > x.YoutubeTranscriptSegment.YoutubeTranscriptId));

        var rows = await q
            .Include(x => x.YoutubeTranscriptSegment)
            .ThenInclude(segment => segment!.YoutubeTranscript)
            .OrderByDescending(x => x.CreatedAt)
            .Take(300)
            .ToListAsync(cancellationToken);

        var keywords = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var ranked = rows.Select(chunk => (Chunk: chunk, Score: ScoreText(chunk.Content, keywords)))
            .OrderByDescending(hit => hit.Score).ThenByDescending(hit => hit.Chunk.CreatedAt)
            .Take(take).ToArray();
        var transcriptIds = ranked.Select(hit => hit.Chunk.YoutubeTranscriptSegment?.YoutubeTranscriptId)
            .OfType<int>().Distinct().ToList();
        var neighbors = transcriptIds.Count == 0 ? [] : await _db.RagDocumentChunks.AsNoTracking()
            .Where(chunk => chunk.YoutubeTranscriptSegment != null &&
                transcriptIds.Contains(chunk.YoutubeTranscriptSegment.YoutubeTranscriptId))
            .Include(chunk => chunk.YoutubeTranscriptSegment)
            .OrderBy(chunk => chunk.YoutubeTranscriptSegment!.Sequence)
            .ToListAsync(cancellationToken);
        var byVersion = neighbors.ToLookup(chunk => chunk.YoutubeTranscriptSegment!.YoutubeTranscriptId);
        var positions = byVersion.SelectMany(group => group.Select((chunk, index) => (chunk.Id, index)))
            .ToDictionary(item => item.Id, item => item.index);
        var chunksByVersion = byVersion.ToDictionary(group => group.Key, group => group.ToArray());

        return ranked.Select(hit =>
        {
            var chunk = hit.Chunk;
            var segment = chunk.YoutubeTranscriptSegment;
            RagDocumentChunk[] context = [chunk];
            if (segment is not null && positions.TryGetValue(chunk.Id, out var index))
            {
                var version = chunksByVersion[segment.YoutubeTranscriptId];
                context = version[Math.Max(0, index - 1)..Math.Min(version.Length, index + 2)];
            }

            return (object)new
            {
                chunk.Id, chunk.SourceType, chunk.SourceId, chunk.SourceName,
                Snippet = segment is null ? BuildSnippet(chunk.Content, query) :
                    string.Join("\n", context.Select(item => item.Content)),
                hit.Score,
                VideoId = segment?.YoutubeTranscript.VideoId,
                VideoUrl = segment is null ? null :
                    $"https://www.youtube.com/watch?v={segment.YoutubeTranscript.VideoId}&t={(long)segment.StartSeconds}s",
                TranscriptId = segment?.YoutubeTranscriptId,
                StartSeconds = segment?.StartSeconds,
                EndSeconds = segment is null ? (double?)null : YoutubeSearchChunks.EndSeconds(chunk),
                ContextStartSeconds = segment is null ? (double?)null : context[0].YoutubeTranscriptSegment!.StartSeconds,
                ContextEndSeconds = segment is null ? (double?)null : context.Max(YoutubeSearchChunks.EndSeconds),
                chunk.CreatedAt
            };
        }).ToList();
    }

    private static int ScoreText(string content, string[] keywords)
    {
        var score = 0;
        foreach (var keyword in keywords)
        {
            var index = 0;
            while (index >= 0)
            {
                index = content.IndexOf(keyword, index, StringComparison.OrdinalIgnoreCase);
                if (index >= 0)
                {
                    score++;
                    index += keyword.Length;
                }
            }
        }

        return score;
    }

    private static string BuildSnippet(string content, string keyword)
    {
        var index = content.IndexOf(keyword, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return content.Length <= 280 ? content : content[..280] + "...";
        }

        var start = Math.Max(index - 80, 0);
        var length = Math.Min(280, content.Length - start);
        var snippet = content.Substring(start, length);
        return start > 0 ? "..." + snippet : snippet;
    }
}
