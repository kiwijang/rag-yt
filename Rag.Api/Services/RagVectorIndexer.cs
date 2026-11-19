using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;

namespace Rag.Api.Services;

/// <summary>Incremental, resumable derived index. Never modifies PostgreSQL source records.</summary>
public sealed class RagVectorIndexer(IServiceScopeFactory scopes, WeaviateVectorStore store,
    BgeEmbeddingService bge, JinaEmbeddingService jina, IWebHostEnvironment env, IHostApplicationLifetime lifetime, ILogger<RagVectorIndexer> logger) : BackgroundService
{
    private readonly SemaphoreSlim wake = new(0, 1);
    private readonly object sync = new();
    private CancellationTokenSource? current;
    private IndexProgress progress = new("idle", 0, 0, 0, null);
    public IndexProgress Status { get { lock (sync) return progress; } }
    public bool Start(int? sourceType = null, int? sourceId = null, int? transcriptId = null)
    {
        lock (sync)
        {
            if (progress.State is "queued" or "running" or "stopping") return false;
            progress = new("queued", 0, 0, 0, null, sourceType, sourceId, transcriptId); wake.Release(); return true;
        }
    }
    public void Cancel() { lock (sync) { if (progress.State == "queued") progress = progress with { State = "cancelled" }; else if (current != null) { progress = progress with { State = "stopping" }; current.Cancel(); } } }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await wake.WaitAsync(TimeSpan.FromMinutes(5), stoppingToken))
                {
                    try { await ReconcileTextAsync(stoppingToken); } catch (Exception error) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning(error, "Deferred vector cleanup will retry"); }
                    continue;
                }
            }
            catch (OperationCanceledException) { break; }
            using var cancel = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            lock (sync) { if (progress.State == "cancelled") continue; current = cancel; progress = progress with { State = "running" }; }
            try { await IndexAsync(cancel.Token); lock (sync) progress = progress with { State = "completed" }; }
            catch (OperationCanceledException) { lock (sync) progress = progress with { State = "cancelled" }; }
            catch (Exception error) { logger.LogError(error, "Vector indexing failed; source records preserved"); lock (sync) progress = progress with { State = "failed", Error = error.Message }; }
            finally { lock (sync) current = null; }
        }
    }
    private void Count(bool changed) { lock (sync) progress = progress with { Processed = progress.Processed + 1, Updated = progress.Updated + (changed ? 1 : 0) }; }
    private async Task IndexAsync(CancellationToken token)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        // A session advisory lock also prevents competing indexers in another API process.
        await db.Database.OpenConnectionAsync(token);
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = "SELECT pg_try_advisory_lock(681240133)";
        if (!Equals(await command.ExecuteScalarAsync(token), true)) throw new VectorServiceException("Another API is indexing. Retry after it finishes.");
        try
        {
            await store.EnsureAsync(WeaviateVectorStore.TextClass, token);
            await store.EnsureAsync(WeaviateVectorStore.ImageClass, token);
            var oldText = await store.ListAsync(WeaviateVectorStore.TextClass, token);
            var selection = Status;
            var oldImages = await store.EntriesAsync(WeaviateVectorStore.ImageClass, token);
            var query = RagVectorDocuments.Eligible(db);
            if (selection.SourceType.HasValue) query = query.Where(c => (int)c.SourceType == selection.SourceType);
            if (selection.SourceId.HasValue) query = query.Where(c => c.SourceId == selection.SourceId);
            if (selection.TranscriptId.HasValue) query = query.Where(c => c.YoutubeTranscriptSegment != null && c.YoutubeTranscriptSegment.YoutubeTranscriptId == selection.TranscriptId);
            var docs = (await RagVectorDocuments.LoadAsync(db, query.OrderBy(c => c.Id), token))
                .Select(RagVectorDocuments.Build).Where(d => !string.IsNullOrWhiteSpace(d.Content)).ToArray();
            var images = selection.SourceType == 1 || selection.TranscriptId.HasValue ? [] :
                (await RagImageDocuments.LoadAsync(db, env, token)).Where(p => !selection.SourceId.HasValue || p.SourceId == selection.SourceId).ToArray();
            lock (sync) progress = progress with { Total = docs.Length + images.Length };
            var pending = docs.Where(d => !oldText.TryGetValue(d.Id, out var old) || old.Hash != d.ContentHash || old.ModelKey != d.ModelKey).ToArray();
            foreach (var _ in docs.Except(pending)) Count(false);
            foreach (var batch in pending.Chunk(8))
            {
                token.ThrowIfCancellationRequested();
                // Cooperative cancellation between batches: keep the GPU gate until CUDA weights are released.
                var result = await bge.EncodeAsync(batch.Select(d => d.Input).ToArray(), false, StoppingToken());
                for (var i = 0; i < batch.Length; i++)
                {
                    var d = batch[i]; await store.UpsertAsync(WeaviateVectorStore.TextClass, d.Id, d.SourceType, d.SourceId, d.Page, d.Content, d.ContentHash, d.ModelKey, result.Vectors[i], token); Count(true);
                }
            }
            foreach (var image in images)
            {
                token.ThrowIfCancellationRequested();
                if (oldImages.Any(old => old.Id == image.Id && old.Hash == image.Hash && old.ModelKey == WeaviateVectorStore.JinaKey)) { Count(false); continue; }
                var result = await jina.EncodeImagesAsync([image.Path], StoppingToken());
                await store.UpsertAsync(WeaviateVectorStore.ImageClass, image.Id, 2, image.SourceId, image.Page, image.Text, image.Hash, WeaviateVectorStore.JinaKey, result.Vectors[0], token); Count(true);
            }
            // Remove obsolete derived vectors only after all current documents have indexed successfully.
            await store.PruneTextAsync(docs.ToDictionary(d => d.Id, d => d.ContentHash), selection.SourceType, selection.SourceId,
                selection.TranscriptId, docs.Select(d => d.Id).ToHashSet(), token);
            if (selection.SourceType != 1 && !selection.TranscriptId.HasValue)
            {
                var ids = images.Select(d => d.Id).ToHashSet();
                foreach (var entry in oldImages.Where(e => (!selection.SourceId.HasValue || e.SourceId == selection.SourceId) && !ids.Contains(e.Id)))
                    await store.DeleteObjectAsync(WeaviateVectorStore.ImageClass, entry.ObjectId, token);
            }
        }
        finally
        {
            command.CommandText = "SELECT pg_advisory_unlock(681240133)"; await command.ExecuteScalarAsync(CancellationToken.None);
            await db.Database.CloseConnectionAsync();
        }
    }
    private CancellationToken StoppingToken() => lifetime.ApplicationStopping;
    private async Task ReconcileTextAsync(CancellationToken token)
    {
        using var scope = scopes.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.OpenConnectionAsync(token);
        await using var command = db.Database.GetDbConnection().CreateCommand(); command.CommandText = "SELECT pg_try_advisory_lock(681240133)";
        if (!Equals(await command.ExecuteScalarAsync(token), true)) return;
        try
        {
            var docs = (await RagVectorDocuments.LoadAsync(db, RagVectorDocuments.Eligible(db), token)).Select(RagVectorDocuments.Build);
            await store.PruneTextAsync(docs.ToDictionary(d => d.Id, d => d.ContentHash), null, null, null, null, token);
        }
        finally { command.CommandText = "SELECT pg_advisory_unlock(681240133)"; await command.ExecuteScalarAsync(CancellationToken.None); }
    }
}
public sealed record IndexProgress(string State, int Processed, int Total, int Updated, string? Error, int? SourceType = null, int? SourceId = null, int? TranscriptId = null,
    bool SupportsScopedEmbedding = true, bool SupportsAtomicChunkEmbedding = true, bool SupportsOriginalTextEmbedding = true);
