using System.Threading.Channels;

namespace Rag.Api.Services;

/// <summary>Bounded concurrency metadata-only enrichment, independent of speech recognition.</summary>
public sealed class YoutubeMetadataQueue(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<YoutubeMetadataQueue> logger) : BackgroundService
{
    private readonly object gate = new();
    private readonly Dictionary<(int SourceId, string VideoId), Job> jobs = [];
    private readonly Channel<Job> pending = Channel.CreateUnbounded<Job>();
    private readonly int workers = Math.Clamp(configuration.GetValue("Youtube:MetadataWorkers", 2), 1, 4);

    public void EnqueueMissing(int sourceId, IEnumerable<SyncedYoutubeVideo> videos)
    {
        lock (gate)
        {
            foreach (var video in videos.Where(YoutubeVideoMetadataStore.NeedsInformation))
            {
                var key = (sourceId, video.VideoId);
                if (jobs.TryGetValue(key, out var existing) &&
                    (existing.State is "queued" or "running" || existing.RetryAfter > DateTime.UtcNow)) continue;
                var job = new Job(sourceId, video.VideoId);
                jobs[key] = job;
                pending.Writer.TryWrite(job);
            }
        }
    }
    public IReadOnlyList<SyncedYoutubeVideo> Decorate(int sourceId, IEnumerable<SyncedYoutubeVideo> videos)
    {
        lock (gate) return videos.Select(video => video with
        {
            MetadataStatus = jobs.TryGetValue((sourceId, video.VideoId), out var job) ? job.State : null
        }).ToArray();
    }
    public void RecordResult(int sourceId, SyncedYoutubeVideo video)
    {
        lock (gate)
        {
            if (!jobs.TryGetValue((sourceId, video.VideoId), out var job)) return;
            job.State = YoutubeVideoMetadataStore.NeedsInformation(video) ? "unavailable" : "complete";
            job.RetryAfter = DateTime.UtcNow.AddMinutes(15);
        }
    }
    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(Enumerable.Range(0, workers).Select(_ => ConsumeAsync(stoppingToken)));
    private async Task ConsumeAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in pending.Reader.ReadAllAsync(stoppingToken))
        {
            lock (gate) job.State = "running";
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var sync = scope.ServiceProvider.GetRequiredService<YoutubeSyncService>();
                var video = await sync.CheckAccessAsync(job.SourceId, job.VideoId, stoppingToken, onlyIfMissing: true);
                if (video is not null) RecordResult(job.SourceId, video);
                else lock (gate) { job.State = "unavailable"; job.RetryAfter = DateTime.UtcNow.AddMinutes(15); }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception error)
            {
                logger.LogInformation(error, "Metadata-only lookup failed for source {SourceId}, video {VideoId}", job.SourceId, job.VideoId);
                lock (gate) { job.State = "failed"; job.RetryAfter = DateTime.UtcNow.AddMinutes(5); }
            }
        }
    }
    private sealed class Job(int sourceId, string videoId)
    {
        public int SourceId { get; } = sourceId;
        public string VideoId { get; } = videoId;
        public string State { get; set; } = "queued";
        public DateTime RetryAfter { get; set; }
    }
}
