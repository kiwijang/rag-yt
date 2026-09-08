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

        var q = _db.RagDocumentChunks.AsNoTracking().AsQueryable();

        if (sourceType.HasValue)
        {
            q = q.Where(x => x.SourceType == sourceType.Value);
        }

        if (sourceId.HasValue)
        {
            q = q.Where(x => x.SourceId == sourceId.Value);
        }

        q = q.Where(x => EF.Functions.ILike(x.Content, $"%{query}%"));

        var rows = await q
            .OrderByDescending(x => x.CreatedAt)
            .Take(300)
            .ToListAsync(cancellationToken);

        var keywords = query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var ranked = rows
            .Select(x => new
            {
                x.Id,
                x.SourceType,
                x.SourceId,
                x.SourceName,
                Snippet = BuildSnippet(x.Content, query),
                Score = ScoreText(x.Content, keywords),
                x.CreatedAt
            })
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.CreatedAt)
            .Take(take)
            .Cast<object>()
            .ToList();

        return ranked;
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
