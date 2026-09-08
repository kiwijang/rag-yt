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

        _db.YoutubeSources.Remove(source);
        await _db.SaveChangesAsync();
        return Ok(new { message = "YouTube source deleted." });
    }

    [HttpPost("youtube/{id:int}/sync")]
    public async Task<IActionResult> SyncYoutubeSource(int id, [FromBody] SyncYoutubeSourceRequest request, CancellationToken cancellationToken)
    {
        var source = await _db.YoutubeSources.FindAsync(id);
        if (source == null) return NotFound();

        var mode = string.Equals(request.Mode, "video", StringComparison.OrdinalIgnoreCase)
            ? YoutubeSyncMode.Video
            : YoutubeSyncMode.Channel;

        try
        {
            var count = await _youtubeSyncService.SyncAsync(source, mode, request.Take, cancellationToken);
            source.Status = SourceStatus.Active;
            source.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                sourceId = source.Id,
                syncedChunks = count,
                mode = mode.ToString()
            });
        }
        catch (Exception ex)
        {
            source.Status = SourceStatus.Error;
            source.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            return BadRequest(new
            {
                message = "YouTube sync failed.",
                error = ex.Message
            });
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

        var (source, chunkCount) = await _pdfOcrService.UploadAndIngestAsync(
            request.Name,
            request.Description,
            request.File,
            cancellationToken);

        return Ok(new
        {
            source,
            chunkCount
        });
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
