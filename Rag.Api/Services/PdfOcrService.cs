using System.Text.Json;
using UglyToad.PdfPig;
using Rag.Api.Data;
using Rag.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Rag.Api.Services;

public class PdfOcrService(IWebHostEnvironment environment, ApplicationDbContext db)
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
            var chunks = ReadChunks(path, source, cancellationToken);
            if (chunks.Count == 0) source.Status = SourceStatus.Error;
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            db.PdfSources.Add(source);
            await db.SaveChangesAsync(cancellationToken);
            foreach (var chunk in chunks) { chunk.SourceId = source.Id; chunk.PdfSourceId = source.Id; }
            db.RagDocumentChunks.AddRange(chunks);
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
        var chunks = ReadChunks(path, source, token);
        if (chunks.Count == 0) throw new InvalidOperationException("PDF contains no embedded text. Scanned pages require an OCR engine; existing chunks were preserved.");
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(74033, {source.Id})", token);
        await db.RagDocumentChunks.Where(x => x.SourceType == SourceType.Pdf && x.SourceId == source.Id).ExecuteDeleteAsync(token);
        await db.PdfPages.Where(x => x.PdfSourceId == source.Id).ExecuteDeleteAsync(token);
        db.RagDocumentChunks.AddRange(chunks);
        source.Status = SourceStatus.Active;
        source.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return chunks.Count;
    }

    private static List<RagDocumentChunk> ReadChunks(string path, PdfSource source, CancellationToken token)
    {
        using var document = PdfDocument.Open(path);
        var chunks = new List<RagDocumentChunk>();
        foreach (var page in document.GetPages())
        {
            token.ThrowIfCancellationRequested();
            var storedPage = new PdfPage { PdfSource = source, PageNumber = page.Number, Text = page.Text };
            foreach (var piece in SplitPage(page.Text))
                chunks.Add(new RagDocumentChunk { SourceType = SourceType.Pdf, SourceId = source.Id, PdfSource = source, PdfPage = storedPage,
                    SourceName = source.Name, Content = piece.Text,
                    MetadataJson = JsonSerializer.Serialize(new { page = page.Number, chunkIndex = chunks.Count + 1,
                        startOffset = piece.Start, endOffset = piece.End, file = source.FileName,
                        chunkSize = 900, overlap = 120, extraction = "embedded-text", chunkingVersion = 2 }) });
        }
        return chunks;
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