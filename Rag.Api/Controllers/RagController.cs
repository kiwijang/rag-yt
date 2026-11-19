using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rag.Api.DTOs;
using Rag.Api.Services;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;
using System.Text.Json.Nodes;

namespace Rag.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RagController : ControllerBase
{
    private readonly RagSearchService _ragSearchService;

    private readonly RagSemanticSearchService semantic;
    private readonly RagVectorIndexer indexer;
    private readonly ILogger<RagController> logger;
    public RagController(RagSearchService ragSearchService, RagSemanticSearchService semantic, RagVectorIndexer indexer, ILogger<RagController> logger)
    {
        _ragSearchService = ragSearchService;
        this.semantic = semantic; this.indexer = indexer; this.logger = logger;
    }

    /// <summary>Inspect incremental BGE-M3 text / Jina CLIP v2 PDF-image indexing progress.</summary>
    [HttpGet("index/status")]
    [Authorize(Roles = "Admin")]
    public IActionResult IndexStatus() => Ok(indexer.Status);

    /// <summary>Index new or changed chunks/pages into Weaviate. Existing PostgreSQL content is preserved.</summary>
    /// <remarks>No request body. Poll GET index/status. Repeat to resume after interruption or refresh edits/deletions.</remarks>
    [HttpPost("index")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Index([FromQuery] int? sourceType, [FromQuery] int? sourceId, [FromQuery] int? transcriptId,
        [FromServices] ApplicationDbContext db, CancellationToken token)
    {
        if (sourceType.HasValue && sourceType is not (1 or 2) || sourceId is <= 0 || transcriptId is <= 0 ||
            (sourceId.HasValue != sourceType.HasValue) || (transcriptId.HasValue && sourceType != 1))
            return BadRequest(new { message = "SourceType/SourceId must be supplied together; TranscriptId requires a YouTube source." });
        if (sourceType == 1 && !await db.YoutubeSources.AnyAsync(s => s.Id == sourceId && s.IsActive, token) ||
           sourceType == 2 && !await db.PdfSources.AnyAsync(s => s.Id == sourceId && s.IsActive, token)) return NotFound(new { message = "Active source not found." });
        if (transcriptId.HasValue)
        {
            var version = await db.YoutubeTranscripts.AsNoTracking().FirstOrDefaultAsync(v => v.Id == transcriptId && v.YoutubeSourceId == sourceId, token);
            if (version == null) return NotFound(new { message = "Transcript version not found in this source." });
            if (await db.YoutubeTranscripts.AnyAsync(v => v.YoutubeSourceId == sourceId && v.VideoId == version.VideoId && v.Id > version.Id, token))
                return Conflict(new { message = "此為歷史版本，預設索引只收錄同影片最新版本。" });
        }
        return indexer.Start(sourceType, sourceId, transcriptId) ? Accepted(indexer.Status) : Conflict(new { message = "已有 embedding 工作執行中，請完成後再試。", progress = indexer.Status });
    }

    /// <summary>Stop indexing at the next inference batch boundary, after CUDA memory is released.</summary>
    [HttpPost("index/cancel")]
    [Authorize(Roles = "Admin")]
    public IActionResult CancelIndex() { indexer.Cancel(); return Accepted(indexer.Status); }

    /// <summary>Read the current PDF page image for a search citation. Requires login and an active PDF source.</summary>
    [HttpGet("pdf/{id:int}/pages/{page:int}/image")]
    public async Task<IActionResult> PageImage(int id, int page, [FromServices] ApplicationDbContext db,
        [FromServices] IWebHostEnvironment env, CancellationToken token)
    {
        var pdfPage = await db.PdfPages.AsNoTracking().FirstOrDefaultAsync(p => p.PdfSourceId == id && p.PageNumber == page && p.PdfSource.IsActive, token);
        if (pdfPage == null) return NotFound();
        var metadata = await db.RagDocumentChunks.AsNoTracking().Where(c => c.PdfPageId == pdfPage.Id && c.PdfSourceId == id)
            .Select(c => c.MetadataJson).FirstOrDefaultAsync(token);
        var asset = JsonNode.Parse(metadata ?? "{}")?["ocrAssetId"]?.GetValue<string>();
        if (!Guid.TryParseExact(asset, "N", out var guid)) return Conflict(new { message = "This page has no MinerU preview." });
        var path = Path.Combine(env.ContentRootPath, "uploads", "pdf", "ocr", guid.ToString("N"), $"page-{page}.png");
        if (!System.IO.File.Exists(path)) return Conflict(new { message = "Page preview is unavailable." });
        Response.Headers.CacheControl = "no-store";
        return Ok(new { pdfPageId = pdfPage.Id, page, imageBase64 = Convert.ToBase64String(await System.IO.File.ReadAllBytesAsync(path, token)) });
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] RagSearchRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
        {
            return BadRequest(new { message = "Query is required." });
        }

        if (request.Query.Length > 2000 || request.Mode is not ("hybrid" or "vector" or "keyword"))
            return BadRequest(new { message = "Query must be at most 2000 characters; mode must be hybrid, vector or keyword." });
        IReadOnlyList<object> results;
        string mode = request.Mode; string? warning = null;
        try
        {
            if (mode == "keyword") results = await _ragSearchService.SearchAsync(request.Query, request.SourceType, request.SourceId, request.Take, cancellationToken);
            else results = await semantic.SearchAsync(request.Query, request.SourceType, request.SourceId, request.Take, request.IncludeImages, mode == "hybrid", cancellationToken);
        }
        catch (Exception error) when (error is HttpRequestException or VectorServiceException or System.Text.Json.JsonException)
        {
            logger.LogWarning(error, "Semantic retrieval unavailable; using keyword fallback");
            mode = "keyword-fallback"; warning = "向量搜尋尚未就緒或服務無法使用，暫用關鍵字搜尋。請由管理員建立／更新向量索引。";
            results = await _ragSearchService.SearchAsync(
            request.Query,
            request.SourceType,
            request.SourceId,
            request.Take,
            cancellationToken);
        }

        return Ok(new
        {
            query = request.Query,
            sourceType = request.SourceType,
            sourceId = request.SourceId,
            count = results.Count,
            searchMode = mode,
            warning,
            items = results
        });
    }
}
