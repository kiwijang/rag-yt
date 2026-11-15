using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using Rag.Api.DTOs;
using Rag.Api.Models;
using Rag.Api.Services;

namespace Rag.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class SourceManagementController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly YoutubeSyncService _youtubeSyncService;
    private readonly PdfOcrService _pdfOcrService;

    public SourceManagementController(ApplicationDbContext db, YoutubeSyncService youtubeSyncService, PdfOcrService pdfOcrService)
    {
        _db = db;
        _youtubeSyncService = youtubeSyncService;
        _pdfOcrService = pdfOcrService;
    }

    [HttpGet("youtube")]
    public async Task<IActionResult> GetYoutubeSources()
    {
        var sources = await _db.YoutubeSources
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        return Ok(sources);
    }

    [HttpGet("youtube/{id:int}")]
    public async Task<IActionResult> GetYoutubeSource(int id)
    {
        var source = await _db.YoutubeSources.FindAsync(id);
        if (source == null) return NotFound();
        return Ok(source);
    }

    [HttpPost("youtube")]
    public async Task<IActionResult> CreateYoutubeSource([FromBody] CreateYoutubeSourceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { message = "Name and URL are required." });

        var source = new YoutubeSource
        {
            Name = request.Name,
            ChannelId = request.ChannelId,
            ChannelName = request.ChannelName,
            Url = request.Url,
            ThumbnailUrl = request.ThumbnailUrl,
            Description = request.Description,
            IsActive = request.IsActive,
            Status = SourceStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.YoutubeSources.Add(source);
        await _db.SaveChangesAsync();

        return Ok(source);
    }

    [HttpPut("youtube/{id:int}")]
    public async Task<IActionResult> UpdateYoutubeSource(int id, [FromBody] UpdateYoutubeSourceRequest request)
    {
        var source = await _db.YoutubeSources.FindAsync(id);
        if (source == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name)) source.Name = request.Name;
        if (!string.IsNullOrWhiteSpace(request.ChannelId)) source.ChannelId = request.ChannelId;
        if (request.ChannelName != null) source.ChannelName = request.ChannelName;
        if (!string.IsNullOrWhiteSpace(request.Url)) source.Url = request.Url;
        if (request.ThumbnailUrl != null) source.ThumbnailUrl = request.ThumbnailUrl;
        if (request.Description != null) source.Description = request.Description;
        if (request.IsActive.HasValue) source.IsActive = request.IsActive.Value;
        if (request.Status.HasValue) source.Status = (SourceStatus)request.Status.Value;

        source.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(source);
    }

    [HttpDelete("youtube/{id:int}")]
    public async Task<IActionResult> DeleteYoutubeSource(int id)
    {
        var source = await _db.YoutubeSources.FindAsync(id);
        if (source == null) return NotFound();

        _db.RagDocumentChunks.RemoveRange(_db.RagDocumentChunks.Where(x =>
            x.SourceType == SourceType.YouTube && x.SourceId == id && x.YoutubeTranscriptSegmentId == null));
        _db.YoutubeSources.Remove(source);
        await _db.SaveChangesAsync();
        return Ok(new { message = "YouTube source deleted." });
    }

    [HttpGet("youtube/{id:int}/videos")]
    public async Task<IActionResult> GetYoutubeVideos(int id, CancellationToken cancellationToken)
    {
        if (!await _db.YoutubeSources.AnyAsync(x => x.Id == id, cancellationToken))
            return NotFound();

        return Ok(await _youtubeSyncService.GetVideosAsync(id, cancellationToken));
    }

    [HttpPost("youtube/{id:int}/videos/enrich-metadata")]
    public async Task<IActionResult> EnrichYoutubeMetadata(int id, CancellationToken cancellationToken)
    {
        if (!await _db.YoutubeSources.AnyAsync(x => x.Id == id, cancellationToken)) return NotFound();
        return Accepted(await _youtubeSyncService.EnrichMissingAsync(id, cancellationToken));
    }

    [HttpPost("youtube/{id:int}/videos/{videoId}/check-access")]
    public async Task<IActionResult> CheckYoutubeVideoAccess(
        int id, string videoId, CancellationToken cancellationToken)
    {
        if (YoutubeTranscriptionService.GetVideoId($"https://youtu.be/{videoId}") != videoId)
            return BadRequest(new { message = "Enter a valid YouTube video ID." });

        try
        {
            var video = await _youtubeSyncService.CheckAccessAsync(id, videoId, cancellationToken);
            return video is null ? NotFound(new { message = "Video is missing from the synchronized list." }) : Ok(video);
        }
        catch (YoutubeListingException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { message = "The access check timed out." });
        }
        catch (System.Text.Json.JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "YouTube returned unreadable metadata." });
        }
    }

    [HttpPost("youtube/{id:int}/sync")]
    public async Task<IActionResult> SyncYoutubeSource(int id, [FromBody] SyncYoutubeSourceRequest request, CancellationToken cancellationToken)
    {
        var source = await _db.YoutubeSources.FindAsync([id], cancellationToken);
        if (source is null)
            return NotFound(new { message = "This YouTube source no longer exists. Refresh the source list and try again." });

        var mode = request.Mode?.Trim().ToLowerInvariant() switch
        {
            "video" => YoutubeSyncMode.Video,
            "channel" => YoutubeSyncMode.Channel,
            _ => (YoutubeSyncMode?)null
        };

        if (mode is null)
            return BadRequest(new { message = "Choose either channel or video sync." });

        if (mode == YoutubeSyncMode.Video && YoutubeTranscriptionService.GetVideoId(source.Url) is null)
            mode = YoutubeSyncMode.Channel;

        if (mode == YoutubeSyncMode.Channel && YoutubeSyncService.GetChannelUrl(source) is null)
            return BadRequest(new
            {
                message = "Enter a single video URL, a YouTube channel URL such as youtube.com/@handle, or a valid UC channel ID."
            });

        try
        {
            var videos = await _youtubeSyncService.SyncAsync(source, mode.Value, cancellationToken);

            return Ok(new
            {
                sourceId = source.Id,
                syncedChunks = videos.Count,
                videos,
                mode = mode.ToString()
            });
        }
        catch (YoutubeListingException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            var message = ex.StatusCode is { } status
                ? $"YouTube returned HTTP {(int)status} while syncing {mode.Value.ToString().ToLowerInvariant()} metadata. Check that the source is publicly accessible."
                : "The API could not connect to YouTube. Check the server's network connection.";
            return StatusCode(StatusCodes.Status502BadGateway, new { message });
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status504GatewayTimeout, new { message = "The YouTube metadata lookup timed out. Retry the sync." });
        }
        catch (Exception ex) when (ex is System.Text.Json.JsonException)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { message = "YouTube returned unreadable metadata." });
        }
    }

    [HttpGet("pdf")]
    public async Task<IActionResult> GetPdfSources()
    {
        var sources = await _db.PdfSources
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        return Ok(sources);
    }

    [HttpGet("pdf/{id:int}")]
    public async Task<IActionResult> GetPdfSource(int id)
    {
        var source = await _db.PdfSources.FindAsync(id);
        if (source == null) return NotFound();
        return Ok(source);
    }

    [HttpPost("pdf")]
    public async Task<IActionResult> CreatePdfSource([FromBody] CreatePdfSourceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(new { message = "Name and URL are required." });

        var source = new PdfSource
        {
            Name = request.Name,
            FileName = request.FileName,
            Url = request.Url,
            Description = request.Description,
            IsActive = request.IsActive,
            Status = SourceStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.PdfSources.Add(source);
        await _db.SaveChangesAsync();

        return Ok(source);
    }

    [HttpPost("pdf/upload")]
    [RequestSizeLimit(200_000_000)]
    public async Task<IActionResult> UploadPdf([FromForm] UploadPdfSourceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });

        if (request.File == null || request.File.Length == 0)
            return BadRequest(new { message = "PDF file is required." });

        if (!request.File.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only PDF files are supported." });

        try
        {
            var (source, chunkCount) = await _pdfOcrService.UploadAndIngestAsync(
                request.Name, request.Description, request.File, cancellationToken);
            return Ok(new
            {
                source = new { source.Id, source.Name, source.FileName, source.Url, source.Description, source.IsActive, source.Status, source.CreatedAt, source.UpdatedAt },
                chunkCount
            });
        }
        catch (InvalidOperationException error) { return UnprocessableEntity(new { message = error.Message }); }
    }

    /// <summary>Read persisted PDF page text for comparing chunk boundaries and overlap.</summary>
    [HttpGet("pdf/{id:int}/pages")]
    public async Task<IActionResult> GetPdfPages(int id, CancellationToken token)
    {
        if (!await _db.PdfSources.AnyAsync(x => x.Id == id, token)) return NotFound();
        return Ok(await _db.PdfPages.AsNoTracking().Where(x => x.PdfSourceId == id)
            .OrderBy(x => x.PageNumber).Select(x => new { x.Id, x.PageNumber, x.Text }).ToListAsync(token));
    }
    /// <summary>List stored PDF RAG chunks, including page and chunking metadata.</summary>
    [HttpGet("pdf/{id:int}/chunks")]
    public async Task<IActionResult> GetPdfChunks(int id, CancellationToken token)
    {
        if (!await _db.PdfSources.AnyAsync(x => x.Id == id, token)) return NotFound();
        return Ok(await _db.RagDocumentChunks.AsNoTracking().Where(x => x.SourceType == SourceType.Pdf && x.SourceId == id)
            .OrderBy(x => x.Id).Select(x => new { x.Id, x.Content, x.MetadataJson, x.PdfPageId }).ToListAsync(token));
    }

    /// <summary>Read an authenticated OCR page preview and aligned text-detection polygons.</summary>
    [HttpGet("pdf/{id:int}/pages/{pageNumber:int}/overlay")]
    public async Task<IActionResult> GetPdfPageOverlay(int id, int pageNumber,
        [FromServices] IWebHostEnvironment environment, CancellationToken token)
    {
        var page = await _db.PdfPages.AsNoTracking().SingleOrDefaultAsync(x => x.PdfSourceId == id && x.PageNumber == pageNumber, token);
        if (page is null) return NotFound();
        var metadata = await _db.RagDocumentChunks.AsNoTracking().Where(x => x.PdfPageId == page.Id && x.PdfSourceId == id)
            .Select(x => x.MetadataJson).FirstOrDefaultAsync(token);
        var root = System.Text.Json.Nodes.JsonNode.Parse(metadata ?? "{}");
        var asset = root?["ocrAssetId"]?.GetValue<string>();
        if (!Guid.TryParseExact(asset, "N", out _))
            return Conflict(new { message = "此頁尚無文字框預覽；舊資料請用 MinerU 重新建立切塊。沒有文字切塊的空白頁不提供文字框。" });
        var directory = Path.Combine(environment.ContentRootPath, "uploads", "pdf", "ocr", asset!);
        var image = Path.Combine(directory, $"page-{pageNumber}.png");
        var geometry = Path.Combine(directory, $"page-{pageNumber}.json");
        if (!System.IO.File.Exists(image) || !System.IO.File.Exists(geometry))
            return Conflict(new { message = "OCR 預覽檔缺失，請從備份還原預覽檔或重新建立 OCR 切塊。" });
        var result = System.Text.Json.Nodes.JsonNode.Parse(await System.IO.File.ReadAllTextAsync(geometry, token))!;
        result["imageBase64"] = Convert.ToBase64String(await System.IO.File.ReadAllBytesAsync(image, token));
        result["pdfPageId"] = page.Id;
        Response.Headers.CacheControl = "no-store";
        return Ok(result);
    }

    /// <summary>Rebuild chunks from the uploaded PDF. Replaces only this PDF's search chunks.</summary>
    [HttpPost("pdf/{id:int}/chunks/rebuild")]
    public async Task<IActionResult> RebuildPdfChunks(int id, CancellationToken token)
    {
        var source = await _db.PdfSources.SingleOrDefaultAsync(x => x.Id == id, token);
        if (source is null) return NotFound();
        try { return Ok(new { chunkCount = await _pdfOcrService.RebuildAsync(source, token) }); }
        catch (FileNotFoundException) { return NotFound(new { message = "Original uploaded PDF is unavailable; upload the document first." }); }
        catch (InvalidOperationException error) { return UnprocessableEntity(new { message = error.Message }); }
    }
    [HttpPut("pdf/{id:int}")]
    public async Task<IActionResult> UpdatePdfSource(int id, [FromBody] UpdatePdfSourceRequest request)
    {
        var source = await _db.PdfSources.FindAsync(id);
        if (source == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name)) source.Name = request.Name;
        if (!string.IsNullOrWhiteSpace(request.FileName)) source.FileName = request.FileName;
        if (!string.IsNullOrWhiteSpace(request.Url)) source.Url = request.Url;
        if (request.Description != null) source.Description = request.Description;
        if (request.IsActive.HasValue) source.IsActive = request.IsActive.Value;
        if (request.Status.HasValue) source.Status = (SourceStatus)request.Status.Value;

        source.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(source);
    }

    [HttpDelete("pdf/{id:int}")]
    public async Task<IActionResult> DeletePdfSource(int id)
    {
        var source = await _db.PdfSources.FindAsync(id);
        if (source == null) return NotFound();

        _db.PdfSources.Remove(source);
        await _db.SaveChangesAsync();
        return Ok(new { message = "PDF source deleted." });
    }
}
