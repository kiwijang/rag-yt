using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Rag.Api.Data;

namespace Rag.Api.Services;

public sealed class TranscriptChunkManagementService(ApplicationDbContext db, YoutubeTranscriptQueue queue,
    BgeEmbeddingService embeddings, WeaviateVectorStore vectors, ILogger<TranscriptChunkManagementService> logger)
{
    public async Task<TranscriptChunkView> ListAsync(int sourceId, int transcriptId, CancellationToken token)
    {
        var version = await db.YoutubeTranscripts.AsNoTracking()
            .Where(x => x.YoutubeSourceId == sourceId && x.Id == transcriptId)
            .Select(x => new { x.Id, x.VideoId, x.Language, x.CreatedAt, SegmentCount = x.Segments.Count })
            .SingleOrDefaultAsync(token) ?? throw new TranscriptManagementException(404, "Transcript version does not belong to this source.");
        var rows = await RagVectorDocuments.LoadAsync(db, db.RagDocumentChunks.AsNoTracking()
            .Where(x => x.YoutubeTranscriptSegment != null && x.YoutubeTranscriptSegment.YoutubeTranscriptId == transcriptId)
            .OrderBy(x => x.YoutubeTranscriptSegment!.Sequence), token);
        var latest = !await db.YoutubeTranscripts.AnyAsync(x => x.YoutubeSourceId == sourceId && x.VideoId == version.VideoId && x.Id > transcriptId, token);
        var chunks = rows.Select(x => new EditableTranscriptChunk(x.Id, x.Content,
            x.YoutubeTranscriptSegment!.Sequence, x.YoutubeTranscriptSegment.StartSeconds,
            YoutubeSearchChunks.EndSeconds(x), x.MetadataJson, TranscriptEmbeddingText.Read(x))).ToArray();
        return new(version.Id, version.VideoId, version.Language, version.CreatedAt, version.SegmentCount,
            latest, queue.Get(sourceId)?.Active == true, chunks);
    }

    public async Task<UpdatedTranscriptChunk> UpdateAsync(int sourceId, int transcriptId, int chunkId,
        string? content, string? originalContent, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(content) || content.Length > 20000 || originalContent is null)
            throw new TranscriptManagementException(400, "Content is required (maximum 20000 characters), with originalContent for conflict detection.");
        RequireIdle(sourceId);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await using (var guard = db.Database.GetDbConnection().CreateCommand())
        {
            guard.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
            guard.CommandText = "SELECT pg_try_advisory_xact_lock(681240133)";
            if (!Equals(await guard.ExecuteScalarAsync(token), true))
                throw new TranscriptManagementException(409, "向量索引或其他切塊正在更新，請完成後再儲存。");
        }
        await LockAsync(transcriptId, token);
        RequireIdle(sourceId);
        if (!await db.YoutubeTranscripts.AnyAsync(x => x.Id == transcriptId && x.YoutubeSourceId == sourceId, token))
            throw new TranscriptManagementException(404, "Transcript version does not belong to this source.");
        var query = db.RagDocumentChunks.Where(x => x.Id == chunkId && x.YoutubeTranscriptSegment != null &&
            x.YoutubeTranscriptSegment.YoutubeTranscriptId == transcriptId);
        if (!await query.AnyAsync(token)) throw new TranscriptManagementException(404, "Chunk does not belong to this transcript version.");
        var updated = content.Trim();
        var chunk = (await RagVectorDocuments.LoadAsync(db, query.AsNoTracking(), token)).Single();
        if (chunk.Content != originalContent) throw new TranscriptManagementException(409, "Chunk content has changed. Reload before saving.");
        chunk.Content = updated;
        chunk.MetadataJson = TranscriptEmbeddingText.MarkEditedOriginal(chunk.MetadataJson);
        var document = RagVectorDocuments.Build(chunk);
        try
        {
            var encoded = await embeddings.EncodeAsync([document.Input], false, token);
            await vectors.EnsureAsync(WeaviateVectorStore.TextClass, token);
            // Immutable revision: search checks the authoritative SQL hash before accepting it.
            await vectors.UpsertAsync(WeaviateVectorStore.TextClass, document.Id, document.SourceType, document.SourceId,
                document.Page, document.Content, document.ContentHash, document.ModelKey, encoded.Vectors[0], token,
                WeaviateVectorStore.RevisionId(document.Id, document.ContentHash));
        }
        catch (Exception error) when (error is HttpRequestException or VectorServiceException or System.Text.Json.JsonException)
        {
            logger.LogWarning(error, "Embedding failed; chunk {ChunkId} was not modified", chunkId);
            throw new TranscriptManagementException(503, "Embedding 更新失敗，切塊尚未修改，原有內容與向量已保留。請稍後重試。");
        }
        var changed = await query.Where(x => x.Content == originalContent)
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.Content, updated).SetProperty(x => x.MetadataJson, chunk.MetadataJson), token);
        if (changed != 1) throw new TranscriptManagementException(409, "Chunk content has changed. Reload before saving.");
        await transaction.CommitAsync(token);
        var cleanupPending = false;
        try
        {
            using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await using var cleanupTransaction = await db.Database.BeginTransactionAsync(cleanup.Token);
            await using var guard = db.Database.GetDbConnection().CreateCommand();
            guard.Transaction = cleanupTransaction.GetDbTransaction(); guard.CommandText = "SELECT pg_try_advisory_xact_lock(681240133)";
            if (!Equals(await guard.ExecuteScalarAsync(cleanup.Token), true)) throw new InvalidOperationException("Vector cleanup deferred while another writer is active.");
            var current = (await RagVectorDocuments.LoadAsync(db, query.AsNoTracking(), cleanup.Token)).SingleOrDefault();
            var hashes = current == null ? new Dictionary<int, string>() : new() { { chunkId, RagVectorDocuments.Build(current).ContentHash } };
            await vectors.PruneTextAsync(hashes, null, null, transcriptId, [chunkId], cleanup.Token);
            await cleanupTransaction.CommitAsync(cleanup.Token);
        }
        catch (Exception error)
        {
            cleanupPending = true; logger.LogWarning(error, "Old vector cleanup pending for chunk {ChunkId}; stale hashes are excluded from search", chunkId);
        }
        return new(chunkId, updated, true, cleanupPending);
    }

    public async Task<TranscriptDeletionPreview> PreviewDeleteAsync(int sourceId, int transcriptId, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await LockAsync(transcriptId, token);
        var preview = await BuildPreviewAsync(sourceId, transcriptId, token);
        await transaction.CommitAsync(token);
        return preview;
    }

    public async Task<TranscriptDeletionResult> DeleteAsync(int sourceId, int transcriptId, int confirmationId,
        string? expectedRevision, CancellationToken token)
    {
        if (confirmationId != transcriptId || string.IsNullOrWhiteSpace(expectedRevision))
            throw new TranscriptManagementException(400, "Confirm the transcript ID and provide the deletion preview revision.");
        RequireIdle(sourceId);
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await LockAsync(transcriptId, token);
        RequireIdle(sourceId);
        var preview = await BuildPreviewAsync(sourceId, transcriptId, token);
        if (!string.Equals(preview.Revision, expectedRevision, StringComparison.Ordinal))
            throw new TranscriptManagementException(409, "The version or its chunks changed after preview. Review a new preview before deleting.");
        var chunks = await db.RagDocumentChunks.Where(x => x.YoutubeTranscriptSegment != null &&
            x.YoutubeTranscriptSegment.YoutubeTranscriptId == transcriptId).ExecuteDeleteAsync(token);
        var segments = await db.YoutubeTranscriptSegments.Where(x => x.YoutubeTranscriptId == transcriptId).ExecuteDeleteAsync(token);
        var versions = await db.YoutubeTranscripts.Where(x => x.Id == transcriptId && x.YoutubeSourceId == sourceId).ExecuteDeleteAsync(token);
        if (versions != 1 || chunks != preview.ChunkCount || segments != preview.SegmentCount)
            throw new TranscriptManagementException(409, "Deletion counts changed. No changes were committed; refresh the preview.");
        await transaction.CommitAsync(token);
        return new(transcriptId, versions, segments, chunks);
    }

    private async Task<TranscriptDeletionPreview> BuildPreviewAsync(int sourceId, int transcriptId, CancellationToken token)
    {
        var version = await db.YoutubeTranscripts.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == transcriptId && x.YoutubeSourceId == sourceId, token)
            ?? throw new TranscriptManagementException(404, "Transcript version does not belong to this source.");
        var segments = await db.YoutubeTranscriptSegments.AsNoTracking().Where(x => x.YoutubeTranscriptId == transcriptId)
            .OrderBy(x => x.Id).Select(x => new { x.Id, x.Sequence, x.StartSeconds, x.EndSeconds, x.Text, x.TraditionalChineseText }).ToListAsync(token);
        var chunks = await db.RagDocumentChunks.AsNoTracking().Where(x => x.YoutubeTranscriptSegment != null &&
                x.YoutubeTranscriptSegment.YoutubeTranscriptId == transcriptId)
            .OrderBy(x => x.Id).Select(x => new { x.Id, x.Content, x.MetadataJson, x.YoutubeTranscriptSegmentId }).ToListAsync(token);
        var revision = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new
        {
            version.Id,
            version.YoutubeSourceId,
            version.VideoId,
            version.Language,
            version.Origin,
            version.Model,
            version.EngineVersion,
            version.CreatedAt,
            version.ProcessingSeconds,
            version.DownloadSeconds,
            version.TranscriptionSeconds,
            version.TranslationSeconds,
            segments,
            chunks
        })));
        var remaining = await db.YoutubeTranscripts.CountAsync(x => x.YoutubeSourceId == sourceId &&
            x.VideoId == version.VideoId && x.Id != transcriptId, token);
        return new(transcriptId, version.VideoId, 1, segments.Count, chunks.Count, remaining,
            queue.Get(sourceId)?.Active == true, revision);
    }
    private void RequireIdle(int sourceId)
    {
        if (queue.Get(sourceId)?.Active == true)
            throw new TranscriptManagementException(409, "Stop this source's transcription batch before editing or deleting its versions.");
    }
    private Task<int> LockAsync(int transcriptId, CancellationToken token) =>
        db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(74031, {transcriptId})", token);
}
public sealed record EditableTranscriptChunk(int Id, string Content, int FirstSequence, double StartSeconds, double EndSeconds, string? MetadataJson, string? EmbeddingText = null);
public sealed record TranscriptChunkView(int TranscriptId, string VideoId, string Language, DateTime CreatedAt,
    int SegmentCount, bool IsLatest, bool IsBatchActive, IReadOnlyList<EditableTranscriptChunk> Chunks);
public sealed record UpdatedTranscriptChunk(int Id, string Content, bool EmbeddingUpdated = false, bool CleanupPending = false);
public sealed record TranscriptDeletionPreview(int TranscriptId, string VideoId, int TranscriptCount,
    int SegmentCount, int ChunkCount, int RemainingVersionCount, bool IsBatchActive, string Revision);
public sealed record TranscriptDeletionResult(int TranscriptId, int DeletedTranscripts, int DeletedSegments, int DeletedChunks);
public sealed class TranscriptManagementException(int statusCode, string message) : Exception(message)
{ public int StatusCode { get; } = statusCode; }
