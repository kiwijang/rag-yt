using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Rag.Api.Services;

/// <summary>Coordinates GPU access and invokes the loopback-only MinerU Docker service.</summary>
public sealed class PdfLayoutInferenceService(IConfiguration config, IHostEnvironment environment,
    IHostApplicationLifetime lifetime, GpuInferenceService speech, ILogger<PdfLayoutInferenceService> logger,
    IHttpClientFactory clients)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<PdfInferredPage>> ExtractAsync(string path, int[] pages, CancellationToken token)
    {
        if (pages.Length == 0) return [];
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token, lifetime.ApplicationStopping);
        timeout.CancelAfter(TimeSpan.FromMinutes(Math.Clamp(config.GetValue("PdfOcr:TimeoutMinutes", 30), 1, 120)));
        await gate.WaitAsync(timeout.Token);
        try
        {
            return config["PdfOcr:Device"] == "cpu"
                ? await RunAsync(path, pages, timeout.Token)
                : await speech.WithExternalInferenceAsync(() => RunAsync(path, pages, timeout.Token), timeout.Token);
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested && !lifetime.ApplicationStopping.IsCancellationRequested)
        { throw new InvalidOperationException("MinerU timed out; existing chunks were preserved."); }
        catch (HttpRequestException error)
        {
            logger.LogWarning(error, "MinerU container is unavailable");
            throw new InvalidOperationException("MinerU service unavailable. Run start-all.bat and check docker compose logs mineru.");
        }
        catch (InvalidDataException error)
        {
            logger.LogWarning(error, "Invalid MinerU result archive");
            throw new InvalidOperationException("MinerU returned an invalid result; existing chunks were preserved.");
        }
        finally { gate.Release(); }
    }

    private async Task<IReadOnlyList<PdfInferredPage>> RunAsync(string path, int[] pages, CancellationToken token)
    {
        var endpoint = (config["PdfOcr:ServiceUrl"] ?? "http://127.0.0.1:8090").TrimEnd('/');
        var assetId = Guid.NewGuid().ToString("N");
        var directory = Path.Combine(environment.ContentRootPath, "uploads", "pdf", "ocr", assetId);
        Directory.CreateDirectory(directory);
        var zip = Path.Combine(Path.GetTempPath(), $"ragyt-mineru-{assetId}.zip");
        var succeeded = false;
        try
        {
            using var client = clients.CreateClient("MinerU");
            using var form = new MultipartFormDataContent();
            var pdf = new StreamContent(File.OpenRead(path));
            pdf.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            form.Add(pdf, "file", "input.pdf");
            form.Add(new StringContent(JsonSerializer.Serialize(pages)), "pages");
            form.Add(new StringContent(config["PdfOcr:Device"] ?? "auto"), "device");
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint + "/parse") { Content = form };
            logger.LogInformation("MinerU request {AssetId}: {Count} pages, device={Device}", assetId, pages.Length, config["PdfOcr:Device"] ?? "auto");
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("MinerU failed with HTTP {Status}; inspect docker compose logs mineru", (int)response.StatusCode);
                throw new InvalidOperationException("MinerU parsing failed. Check docker compose logs mineru; existing chunks were preserved.");
            }
            await using (var stream = await response.Content.ReadAsStreamAsync(token))
            await using (var file = File.Create(zip))
            {
                var buffer = new byte[131072];
                long total = 0;
                int count;
                while ((count = await stream.ReadAsync(buffer, token)) > 0)
                {
                    total += count;
                    if (total > 2L * 1024 * 1024 * 1024) throw new InvalidDataException("MinerU result exceeds 2 GiB");
                    await file.WriteAsync(buffer.AsMemory(0, count), token);
                }
            }
            using var archive = ZipFile.OpenRead(zip);
            var manifest = archive.GetEntry("result.json") ?? throw new InvalidDataException("Result manifest missing");
            if (manifest.Length > 64 * 1024 * 1024) throw new InvalidDataException("Result manifest too large");
            using var reader = new StreamReader(manifest.Open());
            var result = JsonSerializer.Deserialize<PdfInferenceResult>(await reader.ReadToEndAsync(token), Json)
                ?? throw new InvalidDataException("Result manifest empty");
            if (result.Engine != "MinerU" || !result.Pages.Select(page => page.PageNumber).Order().SequenceEqual(pages.Order()))
                throw new InvalidDataException("Unexpected MinerU engine/pages");
            foreach (var page in result.Pages)
            {
                foreach (var extension in new[] { "png", "json" })
                {
                    var name = $"page-{page.PageNumber}.{extension}";
                    var entry = archive.GetEntry(name) ?? throw new InvalidDataException("Page preview missing");
                    if (entry.Length > 32 * 1024 * 1024) throw new InvalidDataException("Page preview too large");
                    await using var input = entry.Open();
                    await using var output = File.Create(Path.Combine(directory, name));
                    await input.CopyToAsync(output, token);
                }
                logger.LogInformation("MinerU page {Page}: {Count} layout blocks on {Device}", page.PageNumber, page.Blocks.Count, page.Device);
            }
            succeeded = true;
            return result.Pages.Select(page => page with { AssetId = assetId }).ToArray();
        }
        finally
        {
            File.Delete(zip);
            if (!succeeded)
            {
                foreach (var file in Directory.EnumerateFiles(directory)) File.Delete(file);
                Directory.Delete(directory);
            }
        }
    }
}

public sealed record PdfInferenceResult(string Engine, IReadOnlyList<PdfInferredPage> Pages);
public sealed record PdfInferredPage(int PageNumber, string Device, int Width, int Height, IReadOnlyList<PdfLayoutBlock> Blocks)
{
    public string? AssetId { get; init; }
}
public sealed record PdfLayoutBlock(string Text, string Type, double[] Bbox);