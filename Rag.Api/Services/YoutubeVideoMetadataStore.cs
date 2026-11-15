using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

/// <summary>Updates only non-transcript video listing metadata, sharing a source lock with sync.</summary>
public sealed class YoutubeVideoMetadataStore(ApplicationDbContext db)
{
    public static bool NeedsInformation(SyncedYoutubeVideo video) => video.Availability is null ||
        (video.DurationSeconds is null && video.Availability is "public" or "unlisted");

    public static string Merge(string? json, string? availability, double? durationSeconds)
    {
        var metadata = JsonNode.Parse(json ?? "{}")!.AsObject();
        if (!string.IsNullOrWhiteSpace(availability)) metadata["availability"] = availability;
        if (durationSeconds is >= 0 && double.IsFinite(durationSeconds.Value)) metadata["durationSeconds"] = durationSeconds.Value;
        return metadata.ToJsonString();
    }
    public static string? VideoId(string? json)
    {
        if (json is null) return null;
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.TryGetProperty("videoId", out var id) && id.ValueKind == JsonValueKind.String) return id.GetString();
        return root.TryGetProperty("Url", out var url) && url.ValueKind == JsonValueKind.String
            ? YoutubeTranscriptionService.GetVideoId(url.GetString() ?? "") : null;
    }
    public async Task PersistAsync(int sourceId, string videoId, string? availability, double? durationSeconds, CancellationToken token)
    {
        if (availability is null && durationSeconds is null) return;
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await LockSourceAsync(db, sourceId, token);
        // Re-read after the lookup/download: sync may have replaced the listing rows in the meantime.
        var rows = await db.RagDocumentChunks.AsNoTracking().Where(x => x.SourceType == SourceType.YouTube &&
            x.SourceId == sourceId && x.YoutubeTranscriptSegmentId == null && x.MetadataJson != null &&
            x.MetadataJson.Contains(videoId)).ToListAsync(token);
        foreach (var row in rows.Where(x => VideoId(x.MetadataJson) == videoId))
        {
            var merged = Merge(row.MetadataJson, availability, durationSeconds);
            await db.RagDocumentChunks.Where(x => x.Id == row.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.MetadataJson, merged), token);
        }
        await transaction.CommitAsync(token);
    }
    public static Task<int> LockSourceAsync(ApplicationDbContext context, int sourceId, CancellationToken token) =>
        context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(74032, {sourceId})", token);
}
