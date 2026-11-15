using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.Services;

namespace Rag.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/SourceManagement/youtube/{id:int}/transcripts")]
public class YoutubeTranscriptsController(
    ApplicationDbContext db, YoutubeTranscriptionService transcription, YoutubeSyncService sync, YoutubeTranscriptQueue queue) : ControllerBase
{
    [HttpPost("batches")]
    public async Task<IActionResult> CreateBatch(
        int id, [FromBody] TranscribeYoutubeBatchRequest request, CancellationToken cancellationToken)
    {
        var language = request.Language?.Trim().ToLowerInvariant();
        if (language is not (null or "ja" or "zh" or "en"))
            return BadRequest(new { message = "Choose Japanese, Chinese, English, or automatic detection." });

        if (!await db.YoutubeSources.AnyAsync(x => x.Id == id, cancellationToken)) return NotFound();
        var requestedIds = request.VideoIds.Distinct(StringComparer.Ordinal).ToArray();
        if (requestedIds.Length == 0)
            return BadRequest(new { message = "Select at least one video." });

        var eligible = (await sync.GetVideosAsync(id, cancellationToken))
            .Where(video => video.Availability is not ("subscriber_only" or "private" or "premium_only" or "needs_auth"))
            .Select(video => video.VideoId).ToHashSet(StringComparer.Ordinal);
        if (!requestedIds.All(eligible.Contains))
            return BadRequest(new { message = "The video list or access status has changed. Refresh it and retry." });

        var queued = queue.Enqueue(id, language, requestedIds);
        return queued.Accepted ? AcceptedAtAction(nameof(GetBatch), new { id }, queued.Snapshot) : Ok(queued.Snapshot);
    }

    [HttpPost("batches/{batchId:guid}/cancel")]
    public async Task<IActionResult> CancelBatch(int id, Guid batchId, CancellationToken cancellationToken)
    {
        var result = await queue.CancelAsync(id, batchId, cancellationToken);
        return result is null
            ? Conflict(new { message = "The batch has changed or no longer exists. Refresh progress before stopping it." })
            : Ok(result);
    }
    [HttpPost("rebuild-search-chunks")]
    public async Task<IActionResult> RebuildSearchChunks(int id, CancellationToken cancellationToken)
    {
        var source = await db.YoutubeSources.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (source is null) return NotFound();

        var versionIds = await db.YoutubeTranscripts.Where(x => x.YoutubeSourceId == id)
            .GroupBy(x => x.VideoId).Select(group => group.Max(x => x.Id))
            .ToListAsync(cancellationToken);
        var rebuilt = 0;
        var chunks = 0;
        foreach (var versionId in versionIds)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(74031, {versionId})", cancellationToken);
            var transcript = await db.YoutubeTranscripts.Include(x => x.Segments)
                .SingleOrDefaultAsync(x => x.Id == versionId, cancellationToken);
            if (transcript is null || transcript.Segments.Count == 0) continue;

            var replacement = YoutubeSearchChunks.Build(transcript, source.Name).ToList();
            await db.RagDocumentChunks.Where(x => x.YoutubeTranscriptSegment != null &&
                x.YoutubeTranscriptSegment.YoutubeTranscriptId == versionId).ExecuteDeleteAsync(cancellationToken);
            db.RagDocumentChunks.AddRange(replacement);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            db.ChangeTracker.Clear();
            rebuilt++;
            chunks += replacement.Count;
        }

        return Ok(new { rebuilt, chunks });
    }

    [HttpGet("batches/latest")]
    public IActionResult GetBatch(int id)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(queue.Get(id));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        int id, [FromBody] TranscribeYoutubeRequest request, CancellationToken cancellationToken)
    {
        var source = await db.YoutubeSources.FindAsync([id], cancellationToken);
        if (source is null) return NotFound();

        var videoId = request.VideoId ?? YoutubeTranscriptionService.GetVideoId(source.Url);
        if (videoId is null || YoutubeTranscriptionService.GetVideoId($"https://youtu.be/{videoId}") != videoId)
            return BadRequest(new { message = "Select a valid YouTube video to transcribe." });

        if (request.VideoId is not null && !await sync.ContainsVideoAsync(id, videoId, cancellationToken))
            return BadRequest(new { message = "This video is no longer in the synchronized list. Refresh the list and retry." });

        var language = request.Language?.Trim().ToLowerInvariant();
        if (language is not (null or "ja" or "zh" or "en"))
            return BadRequest(new { message = "Choose Japanese, Chinese, English, or automatic detection." });

        var existing = await db.YoutubeTranscripts.AsNoTracking()
            .Where(x => x.YoutubeSourceId == id && x.VideoId == videoId && x.Segments.Any())
            .OrderByDescending(x => x.Id)
            .Select(x => new
            {
                transcriptId = x.Id, segmentCount = x.Segments.Count, x.Language,
                x.ProcessingSeconds, x.DownloadSeconds, x.TranscriptionSeconds, x.TranslationSeconds,
                reused = true
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return Ok(existing);

        try
        {
            var result = await transcription.TranscribeAsync(source, videoId, language, cancellationToken);
            return CreatedAtAction(nameof(Get), new { id, transcriptId = result.Id },
                new
                {
                    transcriptId = result.Id, segmentCount = result.Segments.Count, result.Language,
                    result.ProcessingSeconds, result.DownloadSeconds, result.TranscriptionSeconds, result.TranslationSeconds,
                    reused = false
                });
        }
        catch (TranscriptionException ex)
        {
            return UnprocessableEntity(new { stage = ex.Stage, videoId, message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> List(int id, CancellationToken cancellationToken)
    {
        var versions = await db.YoutubeTranscripts
            .Where(x => x.YoutubeSourceId == id)
            .OrderByDescending(x => x.Id)
            .Select(x => new
            {
                x.Id, x.VideoId, x.Language, x.Origin, x.Model, x.EngineVersion, x.CreatedAt,
                x.ProcessingSeconds, x.DownloadSeconds, x.TranscriptionSeconds, x.TranslationSeconds,
                SegmentCount = x.Segments.Count
            })
            .ToListAsync(cancellationToken);
        return Ok(versions);
    }

    [HttpGet("{transcriptId:int}")]
    public async Task<IActionResult> Get(int id, int transcriptId, CancellationToken cancellationToken)
    {
        var result = await db.YoutubeTranscripts
            .Where(x => x.YoutubeSourceId == id && x.Id == transcriptId)
            .Select(x => new
            {
                x.Id, x.VideoId, x.Language, x.Origin, x.Model, x.EngineVersion, x.CreatedAt,
                x.ProcessingSeconds, x.DownloadSeconds, x.TranscriptionSeconds, x.TranslationSeconds,
                Segments = x.Segments.OrderBy(segment => segment.Sequence)
                    .Select(segment => new
                    {
                        segment.Sequence, segment.StartSeconds, segment.EndSeconds,
                        segment.Text, segment.TraditionalChineseText
                    }).ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}

public class TranscribeYoutubeRequest
{
    public string? Language { get; set; }
    public string? VideoId { get; set; }
}

public sealed class TranscribeYoutubeBatchRequest
{
    public string[] VideoIds { get; set; } = [];
    public string? Language { get; set; }
}
