using System.Text.Json;
using UglyToad.PdfPig;
using Rag.Api.Data;
using Rag.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Rag.Api.Services;

public class PdfOcrService(IWebHostEnvironment environment, ApplicationDbContext db, PdfLayoutInferenceService inference)
{
    public async Task<(PdfSource source, int chunkCount)> UploadAndIngestAsync(string name, string? description, IFormFile file, CancellationToken cancellationToken = default)
    {
        var directory = Path.Combine(environment.ContentRootPath, "uploads", "pdf");
        Directory.CreateDirectory(directory);
        var fileName = $"{Guid.NewGuid():N}.pdf";
        var path = Path.Combine(directory, fileName);
        try
        {
            await using (var stream = new FileStream(path, FileMode.CreateNew))
                await file.CopyToAsync(stream, cancellationToken);
            var source = new PdfSource { Name = name, Description = description, FileName = fileName,
                Url = $"/uploads/pdf/{fileName}", Status = SourceStatus.Active };
            var prepared = await ReadChunksAsync(path, source, cancellationToken);
            var chunks = prepared.SelectMany(page => page.Chunks).ToList();
            if (chunks.Count == 0) source.Status = SourceStatus.Error;
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            db.PdfSources.Add(source);
            await db.SaveChangesAsync(cancellationToken);
            foreach (var chunk in chunks) { chunk.SourceId = source.Id; chunk.PdfSourceId = source.Id; }
            db.PdfPages.AddRange(prepared);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (source, chunks.Count);
        }
        catch { if (File.Exists(path)) File.Delete(path); throw; }
    }

    public async Task<int> RebuildAsync(PdfSource source, CancellationToken token)
    {
        // Only read uploaded local files, never a path or remote URL supplied by the client.
        if (Path.GetFileName(source.FileName) != source.FileName || string.IsNullOrWhiteSpace(source.FileName))
            throw new FileNotFoundException("Local PDF file is unavailable.");
        var path = Path.Combine(environment.ContentRootPath, "uploads", "pdf", source.FileName);
        if (!File.Exists(path)) throw new FileNotFoundException("Local PDF file is unavailable.");
        var prepared = await ReadChunksAsync(path, source, token);
        var chunks = prepared.SelectMany(page => page.Chunks).ToList();
        if (chunks.Count == 0) throw new InvalidOperationException("No readable text was found after MinerU parsing; existing chunks were preserved.");
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(74033, {source.Id})", token);
        await db.RagDocumentChunks.Where(x => x.SourceType == SourceType.Pdf && x.SourceId == source.Id).ExecuteDeleteAsync(token);
        await db.PdfPages.Where(x => x.PdfSourceId == source.Id).ExecuteDeleteAsync(token);
        db.PdfPages.AddRange(prepared);
        source.Status = SourceStatus.Active;
        source.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return chunks.Count;
    }

    private async Task<List<PdfPage>> ReadChunksAsync(string path, PdfSource source, CancellationToken token)
    {
        int count;
        using (var document = PdfDocument.Open(path)) count = document.NumberOfPages;
        token.ThrowIfCancellationRequested();
        // MinerU handles both digital text and scans so every parsed page has a common coordinate frame.
        var results = await inference.ExtractAsync(path, Enumerable.Range(1, count).ToArray(), token);
        return results.OrderBy(page => page.PageNumber).Select(page => BuildPage(source, page.PageNumber,
            page.Blocks, "mineru-pipeline", page.Device, page.Width, page.Height, page.AssetId)).ToList();
    }

    public static PdfPage BuildPage(PdfSource source, int number, IReadOnlyList<PdfLayoutBlock> blocks,
        string extraction, string device, int width, int height, string? assetId = null)
    {
        var page = new PdfPage { PdfSource = source, PdfSourceId = source.Id, PageNumber = number };
        var text = new System.Text.StringBuilder();
        string? heading = null;
        foreach (var block in blocks)
        {
            var content = block.Text.Trim();
            if (content.Length == 0) continue;
            if (block.Bbox.Length is not (0 or 4) || block.Bbox.Any(v => !double.IsFinite(v)))
                throw new InvalidOperationException("OCR returned invalid block coordinates; existing chunks were preserved.");
            if (text.Length > 0) text.Append("\n\n");
            var offset = text.Length;
            text.Append(content);
            if (block.Type.Contains("title", StringComparison.OrdinalIgnoreCase)) heading = content[..Math.Min(200, content.Length)];
            // A table is one semantic unit: retain its structure rather than splitting HTML cells at 900 characters.
            IEnumerable<(string Text, int Start, int End)> pieces = block.Type == "table"
                ? [(content, 0, content.Length)] : SplitPage(content);
            foreach (var piece in pieces)
                page.Chunks.Add(new RagDocumentChunk { SourceType = SourceType.Pdf, SourceId = source.Id,
                    PdfSource = source, PdfSourceId = source.Id, PdfPage = page, SourceName = source.Name, Content = piece.Text,
                    MetadataJson = JsonSerializer.Serialize(new { page = number, chunkIndex = page.Chunks.Count + 1,
                        startOffset = offset + piece.Start, endOffset = offset + piece.End, file = source.FileName,
                        chunkSize = 900, overlap = block.Type == "table" ? 0 : 120, extraction, chunkingVersion = 3,
                        blockType = block.Type, bbox = block.Bbox, sectionTitle = heading, device, imageWidth = width, imageHeight = height,
                        ocrAssetId = assetId }) });
        }
        page.Text = text.ToString();
        return page;
    }
    public static IEnumerable<(string Text, int Start, int End)> SplitPage(string text)
    {
        const int size = 900, overlap = 120;
        for (var start = 0; start < text.Length;)
        {
            var end = Math.Min(start + size, text.Length);
            // Prefer a nearby sentence/word boundary; never split a UTF-16 surrogate pair.
            if (end < text.Length)
            {
                for (var boundary = end - 1; boundary >= start + size / 2; boundary--)
                    if (char.IsWhiteSpace(text[boundary]) || ".!?。！？；;".Contains(text[boundary])) { end = boundary + 1; break; }
                if (end > start && char.IsHighSurrogate(text[end - 1])) end--;
            }
            var content = text[start..end];
            if (!string.IsNullOrWhiteSpace(content)) yield return (content, start, end);
            if (end == text.Length) yield break;
            var next = Math.Max(start + 1, end - overlap);
            if (char.IsLowSurrogate(text[next])) next++;
            start = next;
        }
    }
}
