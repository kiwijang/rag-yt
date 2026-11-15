using System.Diagnostics;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;

namespace Rag.Api.Services;

public sealed class YoutubeTranscriptQueue(
    IServiceScopeFactory scopes, IConfiguration configuration, ILogger<YoutubeTranscriptQueue> logger) : BackgroundService
{
    private readonly object gate = new();
    private readonly Dictionary<int, Batch> latest = [];
    private readonly Channel<(Batch Batch, string VideoId)> queue = Channel.CreateUnbounded<(Batch, string)>();
    public int Workers { get; } = Math.Clamp(configuration.GetValue("Transcription:ParallelVideos",
        Environment.ProcessorCount >= 4 && configuration["Transcription:Device"] is null or "cpu" ? 2 : 1),
        1, Math.Min(8, Environment.ProcessorCount));

    public (bool Accepted, TranscriptBatch Snapshot) Enqueue(int sourceId, string? language, IReadOnlyList<string> ids)
    {
        lock (gate)
        {
            if (latest.TryGetValue(sourceId, out var running) && running.Finished < running.Videos.Count)
                return (false, Snapshot(running));
            var batch = new Batch(sourceId, language, ids);
            latest[sourceId] = batch;
            foreach (var id in ids) queue.Writer.TryWrite((batch, id));
            return (true, Snapshot(batch));
        }
    }

    public TranscriptBatch? Get(int sourceId)
    {
        lock (gate) return latest.TryGetValue(sourceId, out var batch) ? Snapshot(batch) : null;
    }

    public async Task<TranscriptBatch?> CancelAsync(int sourceId, Guid batchId, CancellationToken cancellationToken)
    {
        Batch batch;
        lock (gate)
        {
            if (!latest.TryGetValue(sourceId, out batch!) || batch.Id != batchId) return null;
            if (batch.Finished == batch.Videos.Count) return Snapshot(batch);
            batch.StopRequested = true;
            foreach (var video in batch.Videos.Values.ToArray())
            {
                if (video.State == "queued") CompleteLocked(batch, video.VideoId, "cancelled", "cancelled");
                else if (video.State == "running") batch.Videos[video.VideoId] = video with { Stage = "stopping" };
            }
        }
        // Outside the lock: cancellation callbacks must never deadlock progress updates.
        await batch.Cancellation.CancelAsync();
        await batch.Completion.Task.WaitAsync(cancellationToken);
        lock (gate) return Snapshot(batch);
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(Enumerable.Range(0, Workers).Select(_ => ConsumeAsync(stoppingToken)));

    private async Task ConsumeAsync(CancellationToken stoppingToken)
    {
        await foreach (var (batch, id) in queue.Reader.ReadAllAsync(stoppingToken))
        {
            lock (gate)
            {
                if (batch.StopRequested || batch.Videos[id].State != "queued") continue;
                batch.Videos[id] = new(id, "running", "checking", null, null);
            }
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, batch.Cancellation.Token);
            var token = linked.Token;
            try
            {
                token.ThrowIfCancellationRequested();
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var existing = await db.YoutubeTranscripts
                    .Where(x => x.YoutubeSourceId == batch.SourceId && x.VideoId == id && x.Segments.Any())
                    .OrderByDescending(x => x.Id).Select(x => (int?)x.Id).FirstOrDefaultAsync(token);
                if (existing.HasValue)
                {
                    Set(batch, id, "reused", "complete", existing);
                    continue;
                }
                var source = await db.YoutubeSources.FindAsync([batch.SourceId], token);
                if (source is null)
                {
                    Set(batch, id, "failed", "checking", message: "The YouTube source was deleted.");
                    continue;
                }
                var service = scope.ServiceProvider.GetRequiredService<YoutubeTranscriptionService>();
                var transcript = await service.TranscribeAsync(source, id, batch.Language, token,
                    stage => Set(batch, id, "running", stage));
                // A successful commit wins a simultaneous stop request; preserve its saved version.
                Set(batch, id, "saved", "complete", transcript.Id);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception) when (batch.Cancellation.IsCancellationRequested)
            {
                Set(batch, id, "cancelled", "cancelled");
            }
            catch (TranscriptionException error) { Set(batch, id, "failed", error.Stage, message: error.Message); }
            catch (Exception error)
            {
                logger.LogError(error, "Transcription failed for source {SourceId}, video {VideoId}.", batch.SourceId, id);
                Set(batch, id, "failed", "process", message: "Processing failed. Review the API log.");
            }
        }
    }

    private void Set(Batch batch, string id, string state, string stage, int? transcriptId = null, string? message = null)
    {
        lock (gate)
        {
            if (IsTerminal(batch.Videos[id].State)) return;
            if (state == "running") batch.Videos[id] = new(id, state, batch.StopRequested ? "stopping" : stage, transcriptId, message);
            else CompleteLocked(batch, id, state, stage, transcriptId, message);
        }
    }
    private static bool IsTerminal(string state) => state is "saved" or "reused" or "failed" or "cancelled";
    private static void CompleteLocked(Batch batch, string id, string state, string stage, int? transcriptId = null, string? message = null)
    {
        if (IsTerminal(batch.Videos[id].State)) return;
        batch.Videos[id] = new(id, state, stage, transcriptId, message);
        batch.Finished++;
        if (batch.Finished == batch.Videos.Count)
        {
            batch.ElapsedSeconds = Stopwatch.GetElapsedTime(batch.Started).TotalSeconds;
            batch.Completion.TrySetResult();
        }
    }
    private static TranscriptBatch Snapshot(Batch batch) => new(
        batch.Id, batch.Finished, batch.Videos.Count, batch.Finished < batch.Videos.Count,
        batch.ElapsedSeconds ?? Stopwatch.GetElapsedTime(batch.Started).TotalSeconds, [.. batch.Videos.Values], batch.StopRequested);
    private sealed class Batch(int sourceId, string? language, IReadOnlyList<string> ids)
    {
        public Guid Id { get; } = Guid.NewGuid();
        public int SourceId { get; } = sourceId;
        public string? Language { get; } = language;
        public long Started { get; } = Stopwatch.GetTimestamp();
        public int Finished { get; set; }
        public bool StopRequested { get; set; }
        public double? ElapsedSeconds { get; set; }
        public CancellationTokenSource Cancellation { get; } = new();
        public TaskCompletionSource Completion { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Dictionary<string, TranscriptVideoProgress> Videos { get; } = ids.ToDictionary(
            id => id, id => new TranscriptVideoProgress(id, "queued", "queued", null, null));
    }
}
public sealed record TranscriptBatch(Guid Id, int Finished, int Total, bool Active, double ElapsedSeconds,
    IReadOnlyList<TranscriptVideoProgress> Videos, bool StopRequested = false);
public sealed record TranscriptVideoProgress(string VideoId, string State, string Stage, int? TranscriptId, string? Message);
