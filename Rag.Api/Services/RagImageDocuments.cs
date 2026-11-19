using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Data;

namespace Rag.Api.Services;

public static class RagImageDocuments
{
    public static async Task<ImageDocument[]> LoadAsync(ApplicationDbContext db, IWebHostEnvironment env, CancellationToken token)
    {
        var pages = await db.PdfPages.AsNoTracking().Where(p => p.PdfSource.IsActive)
            .Include(p => p.PdfSource).Include(p => p.Chunks).ToListAsync(token);
        var results = new List<ImageDocument>();
        foreach (var page in pages)
        {
            string? asset = null;
            foreach (var chunk in page.Chunks)
            {
                if (string.IsNullOrWhiteSpace(chunk.MetadataJson)) continue;
                using var json = JsonDocument.Parse(chunk.MetadataJson);
                if (json.RootElement.TryGetProperty("ocrAssetId", out var value) && value.ValueKind == JsonValueKind.String &&
                    Guid.TryParseExact(value.GetString(), "N", out var id)) { asset = id.ToString("N"); break; }
            }
            if (asset == null) continue;
            var path = Path.Combine(env.ContentRootPath, "uploads", "pdf", "ocr", asset, $"page-{page.PageNumber}.png");
            if (!File.Exists(path)) continue;
            await using var stream = File.OpenRead(path);
            var imageHash = Convert.ToHexString(await SHA256.HashDataAsync(stream, token));
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{WeaviateVectorStore.JinaKey}|{page.Id}|{page.PdfSourceId}|{page.PageNumber}|{page.Text}|{imageHash}")));
            results.Add(new(page.Id, page.PdfSourceId, page.PageNumber, page.PdfSource.Name, page.Text, path, hash));
        }
        return results.ToArray();
    }
}
public sealed record ImageDocument(int Id, int SourceId, int Page, string SourceName, string Text, string Path, string Hash);
