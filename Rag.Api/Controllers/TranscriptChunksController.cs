using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rag.Api.Services;

namespace Rag.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/SourceManagement/youtube/{id:int}/transcripts/{transcriptId:int}")]
public sealed class TranscriptChunksController(TranscriptChunkManagementService management) : ControllerBase
{
    [HttpGet("chunks")]
    public Task<ActionResult<TranscriptChunkView>> List(int id, int transcriptId, CancellationToken cancellationToken) =>
        Respond(() => management.ListAsync(id, transcriptId, cancellationToken));

    [HttpPut("chunks/{chunkId:int}")]
    public Task<ActionResult<UpdatedTranscriptChunk>> Update(int id, int transcriptId, int chunkId,
        [FromBody] UpdateTranscriptChunkRequest request, CancellationToken cancellationToken) =>
        Respond(() => management.UpdateAsync(id, transcriptId, chunkId, request.Content, request.OriginalContent, cancellationToken));

    [HttpGet("deletion-preview")]
    public Task<ActionResult<TranscriptDeletionPreview>> PreviewDelete(int id, int transcriptId, CancellationToken cancellationToken) =>
        Respond(() => management.PreviewDeleteAsync(id, transcriptId, cancellationToken));

    [HttpDelete]
    public Task<ActionResult<TranscriptDeletionResult>> DeleteVersion(int id, int transcriptId,
        [FromBody] DeleteTranscriptVersionRequest request, CancellationToken cancellationToken) =>
        Respond(() => management.DeleteAsync(id, transcriptId, request.ConfirmationId, request.ExpectedRevision, cancellationToken));

    private async Task<ActionResult<T>> Respond<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (TranscriptManagementException error) { return StatusCode(error.StatusCode, new { message = error.Message }); }
    }
}
public sealed class UpdateTranscriptChunkRequest
{
    public string? Content { get; set; }
    public string? OriginalContent { get; set; }
}
public sealed class DeleteTranscriptVersionRequest
{
    public int ConfirmationId { get; set; }
    public string? ExpectedRevision { get; set; }
}
