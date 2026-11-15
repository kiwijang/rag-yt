using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public class YoutubeSyncService
{
    private readonly HttpClient _httpClient;
    private readonly ApplicationDbContext _db;

    private readonly YoutubeMediaService _media;
    private readonly YoutubeVideoMetadataStore _metadata;
    private readonly YoutubeMetadataQueue _metadataQueue;
    private readonly ILogger<YoutubeSyncService> _logger;

    public YoutubeSyncService(HttpClient httpClient, ApplicationDbContext db,
        ILogger<YoutubeSyncService> logger, YoutubeMediaService media, YoutubeVideoMetadataStore metadata, YoutubeMetadataQueue metadataQueue)
    {
        _httpClient = httpClient;
        _db = db;
        _media = media;
        _metadata = metadata;
        _metadataQueue = metadataQueue;
        _logger = logger;
    }

    public static string? GetChannelUrl(YoutubeSource source)
    {
        var channelId = source.ChannelId?.Trim();
        if (channelId is not null && Regex.IsMatch(channelId, @"\AUC[A-Za-z0-9_-]{22}\z"))
            return $"https://www.youtube.com/channel/{channelId}";

        if (!Uri.TryCreate(source.Url, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("https" or "http") ||
            uri.Host.ToLowerInvariant() is not ("youtube.com" or "www.youtube.com" or "m.youtube.com"))
            return null;

        var path = uri.AbsolutePath.TrimEnd('/');
        var match = Regex.Match(path,
            @"\A(/(?:@[\p{L}\p{N}._%~-]+|channel/UC[A-Za-z0-9_-]{22}|(?:c|user)/[\p{L}\p{N}._%~-]+))(?:/(?:videos|shorts|streams|featured|playlists|community|posts|about|live))?\z");
        return match.Success ? $"https://www.youtube.com{match.Groups[1].Value}" : null;
    }

    public async Task<IReadOnlyList<SyncedYoutubeVideo>> SyncAsync(
        YoutubeSource source, YoutubeSyncMode mode, CancellationToken cancellationToken = default)
    {
        var chunks = mode == YoutubeSyncMode.Video
            ? await SyncSingleVideoAsync(source, cancellationToken)
            : await SyncChannelAsync(source, cancellationToken);

        var videos = ReadVideos(chunks);
        if (videos.Count == 0)
            throw new YoutubeListingException("YouTube returned no public videos for this channel. Check the channel URL and whether it has public uploads.");

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        await YoutubeVideoMetadataStore.LockSourceAsync(_db, source.Id, cancellationToken);
        var oldChunks = await _db.RagDocumentChunks
            .Where(x => x.SourceType == SourceType.YouTube && x.SourceId == source.Id
                && x.YoutubeTranscriptSegmentId == null).ToListAsync(cancellationToken);
        var oldVideos = ReadVideos(oldChunks).ToDictionary(x => x.VideoId);
        foreach (var chunk in chunks)
        {
            var fresh = ReadVideos([chunk]).Single();
            if (oldVideos.TryGetValue(fresh.VideoId, out var saved))
                chunk.MetadataJson = YoutubeVideoMetadataStore.Merge(chunk.MetadataJson,
                    fresh.Availability ?? saved.Availability, fresh.DurationSeconds ?? saved.DurationSeconds);
        }
        _db.RagDocumentChunks.RemoveRange(oldChunks);
        _db.RagDocumentChunks.AddRange(chunks);
        source.Status = SourceStatus.Active;
        source.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        videos = ReadVideos(chunks);
        _metadataQueue.EnqueueMissing(source.Id, videos);
        return _metadataQueue.Decorate(source.Id, videos);
    }

    public async Task<IReadOnlyList<SyncedYoutubeVideo>> EnrichMissingAsync(int sourceId, CancellationToken token)
    {
        var videos = await GetVideosAsync(sourceId, token);
        _metadataQueue.EnqueueMissing(sourceId, videos);
        return _metadataQueue.Decorate(sourceId, videos);
    }

    public async Task<IReadOnlyList<SyncedYoutubeVideo>> GetVideosAsync(
        int sourceId, CancellationToken cancellationToken)
    {
        var chunks = await _db.RagDocumentChunks.AsNoTracking()
            .Where(chunk => chunk.SourceType == SourceType.YouTube && chunk.SourceId == sourceId
                && chunk.YoutubeTranscriptSegmentId == null)
            .OrderBy(chunk => chunk.Id)
            .ToListAsync(cancellationToken);
        return _metadataQueue.Decorate(sourceId, ReadVideos(chunks));
    }

    public async Task<bool> ContainsVideoAsync(int sourceId, string videoId, CancellationToken cancellationToken)
    {
        var candidates = await _db.RagDocumentChunks.AsNoTracking()
            .Where(chunk => chunk.SourceType == SourceType.YouTube && chunk.SourceId == sourceId
                && chunk.YoutubeTranscriptSegmentId == null && chunk.MetadataJson != null
                && chunk.MetadataJson.Contains(videoId))
            .ToListAsync(cancellationToken);
        return ReadVideos(candidates).Any(video => video.VideoId == videoId);
    }

    public async Task<SyncedYoutubeVideo?> CheckAccessAsync(
        int sourceId, string videoId, CancellationToken cancellationToken, bool onlyIfMissing = false)
    {
        var candidates = await _db.RagDocumentChunks.AsNoTracking()
            .Where(chunk => chunk.SourceType == SourceType.YouTube && chunk.SourceId == sourceId
                && chunk.YoutubeTranscriptSegmentId == null && chunk.MetadataJson != null
                && chunk.MetadataJson.Contains(videoId))
            .ToListAsync(cancellationToken);
        var chunk = candidates.FirstOrDefault(candidate => ReadVideos([candidate]).Any(video => video.VideoId == videoId));
        if (chunk is null) return null;

        var saved = ReadVideos([chunk]).Single();
        if (onlyIfMissing && !YoutubeVideoMetadataStore.NeedsInformation(saved)) return saved;
        string? availability;
        double? durationSeconds = null;
        try
        {
            using var document = await ReadYtDlpMetadataAsync(saved.Url, isChannel: false, cancellationToken);
            availability = ReadString(document.RootElement, "availability");
            durationSeconds = ReadDuration(document.RootElement, "duration");
        }
        catch (YoutubeListingException error) when (error.Availability is not null)
        {
            availability = error.Availability;
        }

        if (availability is null && durationSeconds is null) { _metadataQueue.RecordResult(sourceId, saved); return _metadataQueue.Decorate(sourceId, [saved])[0]; }

        await _metadata.PersistAsync(sourceId, videoId, availability, durationSeconds, cancellationToken);
        var result = saved with
        {
            Availability = availability ?? saved.Availability,
            DurationSeconds = durationSeconds ?? saved.DurationSeconds
        };
        _metadataQueue.RecordResult(sourceId, result);
        return _metadataQueue.Decorate(sourceId, [result])[0];
    }

    private static IReadOnlyList<SyncedYoutubeVideo> ReadVideos(IEnumerable<RagDocumentChunk> chunks)
    {
        var videos = new List<SyncedYoutubeVideo>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var chunk in chunks)
        {
            if (chunk.MetadataJson is null) continue;
            using var metadata = JsonDocument.Parse(chunk.MetadataJson);
            var root = metadata.RootElement;
            var videoId = root.TryGetProperty("videoId", out var id) ? id.GetString() : null;
            if (videoId is null && root.TryGetProperty("Url", out var url))
                videoId = YoutubeTranscriptionService.GetVideoId(url.GetString() ?? "");

            if (videoId is null ||
                YoutubeTranscriptionService.GetVideoId($"https://youtu.be/{videoId}") != videoId ||
                !seen.Add(videoId))
                continue;
            var firstLine = chunk.Content.Split('\n', 2)[0];
            var title = root.TryGetProperty("title", out var name)
                ? name.GetString()
                : firstLine[(firstLine.IndexOf(':') + 1)..].Trim();
            videos.Add(new(videoId, title ?? chunk.SourceName, $"https://www.youtube.com/watch?v={videoId}",
                ReadString(root, "availability"), ReadDuration(root, "durationSeconds")));
        }

        return videos;
    }

    private async Task<List<RagDocumentChunk>> SyncSingleVideoAsync(YoutubeSource source, CancellationToken cancellationToken)
    {
        var videoId = YoutubeTranscriptionService.GetVideoId(source.Url)
            ?? throw new InvalidOperationException("Sync Video requires a single YouTube video URL.");
        var videoUrl = $"https://www.youtube.com/watch?v={videoId}";
        var oEmbedUrl = $"https://www.youtube.com/oembed?url={Uri.EscapeDataString(videoUrl)}&format=json";

        string? title;
        string? author;
        string? availability = null;
        double? durationSeconds = null;
        try
        {
            var json = await _httpClient.GetStringAsync(oEmbedUrl, cancellationToken);
            using var document = JsonDocument.Parse(json);
            title = ReadString(document.RootElement, "title");
            author = ReadString(document.RootElement, "author_name");
            try
            {
                using var videoMetadata = await ReadYtDlpMetadataAsync(videoUrl, isChannel: false, cancellationToken);
                durationSeconds = ReadDuration(videoMetadata.RootElement, "duration");
                availability = ReadString(videoMetadata.RootElement, "availability");
            }
            catch (Exception error) when (error is YoutubeListingException or JsonException ||
                (error is OperationCanceledException && !cancellationToken.IsCancellationRequested))
            {
                _logger.LogInformation(error, "Could not enrich metadata for {VideoId}.", videoId);
            }
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized)
        {
            _logger.LogInformation("YouTube oEmbed returned {Status} for {VideoId}. Looking up metadata with yt-dlp.",
                ex.StatusCode, videoId);
            try
            {
                using var document = await ReadYtDlpMetadataAsync(videoUrl, isChannel: false, cancellationToken);
                title = ReadString(document.RootElement, "title");
                author = ReadString(document.RootElement, "channel") ?? ReadString(document.RootElement, "uploader");
                availability = ReadString(document.RootElement, "availability");
                durationSeconds = ReadDuration(document.RootElement, "duration");
            }
            catch (YoutubeListingException error) when (error.Availability is not null)
            {
                title = source.Name;
                author = source.ChannelName;
                availability = error.Availability;
            }
        }

        title ??= source.Name;
        author ??= source.ChannelName;

        return
        [
            new RagDocumentChunk
            {
                SourceType = SourceType.YouTube,
                SourceId = source.Id,
                SourceName = source.Name,
                Content = $"YouTube Video: {title}\nChannel: {author}\nURL: {source.Url}\nDescription: {source.Description}",
                MetadataJson = JsonSerializer.Serialize(new { mode = "video", source.Url, source.ChannelId, source.ChannelName, videoId, title, availability, durationSeconds }),
                CreatedAt = DateTime.UtcNow
            }
        ];
    }

    private async Task<List<RagDocumentChunk>> SyncChannelAsync(
        YoutubeSource source, CancellationToken cancellationToken)
    {
        var channelUrl = GetChannelUrl(source)
            ?? throw new YoutubeListingException("Enter a valid YouTube channel URL or UC channel ID.");
        using var document = await ReadYtDlpMetadataAsync(channelUrl, isChannel: true, cancellationToken);
        return ReadChannelEntries(document.RootElement)
            .GroupBy(video => video.VideoId, StringComparer.Ordinal)
            .Select(group => group.OrderByDescending(video => video.Availability is "subscriber_only" or "private" or "premium_only" or "needs_auth")
                .ThenByDescending(video => video.Availability is not null).First() with
                {
                    DurationSeconds = group.Select(video => video.DurationSeconds).FirstOrDefault(value => value.HasValue)
                })
            .Select(video => new RagDocumentChunk
            {
                SourceType = SourceType.YouTube,
                SourceId = source.Id,
                SourceName = source.Name,
                Content = $"YouTube Channel Video: {video.Title}\nURL: {video.Url}",
                MetadataJson = JsonSerializer.Serialize(new { mode = "channel", videoId = video.VideoId, title = video.Title, availability = video.Availability, durationSeconds = video.DurationSeconds }),
                CreatedAt = DateTime.UtcNow
            })
            .ToList();
    }

    private async Task<JsonDocument> ReadYtDlpMetadataAsync(
        string url, bool isChannel, CancellationToken cancellationToken)
    {
        try { return await _media.ReadMetadataAsync(url, isChannel, cancellationToken); }
        catch (MediaCommandException error)
        {
            _logger.LogWarning(error, "yt-dlp metadata lookup failed.");
            var detail = error.Message.Split('\n', StringSplitOptions.TrimEntries)
                .LastOrDefault(line => line.StartsWith("ERROR:", StringComparison.Ordinal)) ?? error.Message;
            throw new YoutubeListingException($"Could not read YouTube metadata. {detail}", error)
            { Availability = isChannel ? null : ReadAccessError(detail) };
        }
    }

    private static string? ReadAccessError(string? detail)
    {
        if (detail is null) return null;
        const RegexOptions options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;
        if (Regex.IsMatch(detail, @"members[- ]only|available to this channel.s members|join this channel to get access", options))
            return "subscriber_only";
        if (Regex.IsMatch(detail, @"\bprivate video\b", options))
            return "private";
        if (Regex.IsMatch(detail, @"\b(?:requires YouTube Premium|available only (?:with|to) YouTube Premium)\b", options))
            return "premium_only";
        return null;
    }

    private static string? ReadString(JsonElement entry, string propertyName) =>
        entry.ValueKind == JsonValueKind.Object &&
        entry.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static double? ReadDuration(JsonElement entry, string key) =>
        entry.ValueKind == JsonValueKind.Object &&
        entry.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number &&
        value.TryGetDouble(out var seconds) && double.IsFinite(seconds) && seconds > 0
            ? seconds
            : null;

    private static IEnumerable<SyncedYoutubeVideo> ReadChannelEntries(JsonElement entry)
    {
        if (entry.ValueKind != JsonValueKind.Object) yield break;
        if (entry.TryGetProperty("entries", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in children.EnumerateArray())
            {
                foreach (var video in ReadChannelEntries(child))
                    yield return video;
            }

            yield break;
        }

        if (!entry.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String) yield break;
        var videoId = id.GetString();
        var url = $"https://www.youtube.com/watch?v={videoId}";
        if (videoId is null || YoutubeTranscriptionService.GetVideoId(url) != videoId) yield break;

        var title = entry.TryGetProperty("title", out var name) && name.ValueKind == JsonValueKind.String
            ? name.GetString()
            : null;
        yield return new(videoId, title ?? videoId, url, ReadString(entry, "availability"),
            ReadDuration(entry, "duration"));
    }
}

public record SyncedYoutubeVideo(string VideoId, string Title, string Url, string? Availability = null, double? DurationSeconds = null)
{
    public string? MetadataStatus { get; init; }
}

public class YoutubeListingException(string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public string? Availability { get; init; }
}
