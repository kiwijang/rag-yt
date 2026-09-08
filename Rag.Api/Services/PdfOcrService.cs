using System.Text.Json;
using UglyToad.PdfPig;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public class PdfOcrService
{
    private readonly IWebHostEnvironment _environment;
    private readonly ApplicationDbContext _db;

    public PdfOcrService(IWebHostEnvironment environment, ApplicationDbContext db)
    {
        _environment = environment;
        _db = db;
    }

    public async Task<(PdfSource source, int chunkCount)> UploadAndIngestAsync(string name, string? description, IFormFile file, CancellationToken cancellationToken = default)
    {
        var uploadsDir = Path.Combine(_environment.ContentRootPath, "uploads", "pdf");
        Directory.CreateDirectory(uploadsDir);

        var safeFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Path.GetFileName(file.FileName)}";
        var filePath = Path.Combine(uploadsDir, safeFileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        var source = new PdfSource
        {
            Name = name,
            Description = description,
            FileName = safeFileName,
            Url = $"/uploads/pdf/{safeFileName}",
            IsActive = true,
            Status = SourceStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.PdfSources.Add(source);
        await _db.SaveChangesAsync(cancellationToken);

        var extractedText = ExtractTextFromPdf(filePath);
        if (string.IsNullOrWhiteSpace(extractedText))
        {
            extractedText = "OCR fallback note: no embedded text was found in this PDF. Integrate native OCR engine for scanned documents.";
            source.Status = SourceStatus.Error;
        }

        var chunks = ChunkText(extractedText, 900)
            .Select((content, idx) => new RagDocumentChunk
            {
                SourceType = SourceType.Pdf,
                SourceId = source.Id,
                SourceName = source.Name,
                Content = content,
                MetadataJson = JsonSerializer.Serialize(new { page = idx + 1, file = source.FileName }),
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        _db.RagDocumentChunks.AddRange(chunks);
        await _db.SaveChangesAsync(cancellationToken);

        return (source, chunks.Count);
    }

    private static string ExtractTextFromPdf(string filePath)
    {
        using var document = PdfDocument.Open(filePath);
        var pageTexts = document.GetPages().Select(p => p.Text).Where(t => !string.IsNullOrWhiteSpace(t));
        return string.Join("\n\n", pageTexts);
    }

    private static IEnumerable<string> ChunkText(string text, int chunkSize)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;

        for (var i = 0; i < text.Length; i += chunkSize)
        {
            var len = Math.Min(chunkSize, text.Length - i);
            yield return text.Substring(i, len);
        }
    }
}
