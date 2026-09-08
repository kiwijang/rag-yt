using System.Text.Json;
using System.Xml.Linq;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public class YoutubeSyncService
{
    private readonly HttpClient _httpClient;
    private readonly ApplicationDbContext _db;

    public YoutubeSyncService(HttpClient httpClient, ApplicationDbContext db)
    {
        _httpClient = httpClient;
        _db = db;
    }

    public async Task<int> SyncAsync(YoutubeSource source, YoutubeSyncMode mode, int take, CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 50);

        var chunks = mode == YoutubeSyncMode.Video
            ? await SyncSingleVideoAsync(source, cancellationToken)
            : await SyncChannelAsync(source, take, cancellationToken);

        var oldChunks = _db.RagDocumentChunks
            .Where(x => x.SourceType == SourceType.YouTube && x.SourceId == source.Id);
        _db.RagDocumentChunks.RemoveRange(oldChunks);

        _db.RagDocumentChunks.AddRange(chunks);
        await _db.SaveChangesAsync(cancellationToken);

        return chunks.Count;
    }

    private async Task<List<RagDocumentChunk>> SyncSingleVideoAsync(YoutubeSource source, CancellationToken cancellationToken)
    {
        var videoUrl = source.Url;
        var oEmbedUrl = $"https://www.youtube.com/oembed?url={Uri.EscapeDataString(videoUrl)}&format=json";

        var json = await _httpClient.GetStringAsync(oEmbedUrl, cancellationToken);
        using var doc = JsonDocument.Parse(json);

        var title = doc.RootElement.TryGetProperty("title", out var t) ? t.GetString() : source.Name;
        var author = doc.RootElement.TryGetProperty("author_name", out var a) ? a.GetString() : source.ChannelName;

        return
        [
            new RagDocumentChunk
            {
                SourceType = SourceType.YouTube,
                SourceId = source.Id,
                SourceName = source.Name,
                Content = $"YouTube Video: {title}\nChannel: {author}\nURL: {source.Url}\nDescription: {source.Description}",
                MetadataJson = JsonSerializer.Serialize(new { mode = "video", source.Url, source.ChannelId, source.ChannelName }),
                CreatedAt = DateTime.UtcNow
            }
        ];
    }

    private async Task<List<RagDocumentChunk>> SyncChannelAsync(YoutubeSource source, int take, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(source.ChannelId))
        {
            throw new InvalidOperationException("ChannelId is required for channel sync mode.");
        }

        var feedUrl = $"https://www.youtube.com/feeds/videos.xml?channel_id={Uri.EscapeDataString(source.ChannelId)}";
        var xml = await _httpClient.GetStringAsync(feedUrl, cancellationToken);
        var xdoc = XDocument.Parse(xml);

        XNamespace atom = "http://www.w3.org/2005/Atom";
        XNamespace yt = "http://www.youtube.com/xml/schemas/2015";
        XNamespace media = "http://search.yahoo.com/mrss/";

        var entries = xdoc.Root?
            .Elements(atom + "entry")
            .Take(take)
            .ToList() ?? [];

        var chunks = new List<RagDocumentChunk>();
        foreach (var entry in entries)
        {
            var videoId = entry.Element(yt + "videoId")?.Value ?? string.Empty;
            var title = entry.Element(atom + "title")?.Value ?? "Untitled";
            var description = entry.Element(media + "group")?.Element(media + "description")?.Value ?? string.Empty;
            var videoUrl = string.IsNullOrWhiteSpace(videoId)
                ? source.Url
                : $"https://www.youtube.com/watch?v={videoId}";

            chunks.Add(new RagDocumentChunk
            {
                SourceType = SourceType.YouTube,
                SourceId = source.Id,
                SourceName = source.Name,
                Content = $"YouTube Channel Video: {title}\nURL: {videoUrl}\nDescription: {description}",
                MetadataJson = JsonSerializer.Serialize(new { mode = "channel", source.ChannelId, videoId }),
                CreatedAt = DateTime.UtcNow
            });
        }

        return chunks;
    }
}
