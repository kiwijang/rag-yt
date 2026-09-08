using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rag.Api.DTOs;
using Rag.Api.Services;

namespace Rag.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RagController : ControllerBase
{
    private readonly RagSearchService _ragSearchService;

    public RagController(RagSearchService ragSearchService)
    {
        _ragSearchService = ragSearchService;
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] RagSearchRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
        {
            return BadRequest(new { message = "Query is required." });
        }

        var results = await _ragSearchService.SearchAsync(
            request.Query,
            request.SourceType,
            request.SourceId,
            request.Take,
            cancellationToken);

        return Ok(new
        {
            query = request.Query,
            sourceType = request.SourceType,
            sourceId = request.SourceId,
            count = results.Count,
            items = results
        });
    }
}
