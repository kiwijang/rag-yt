using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Rag.Api.Data;
using Rag.Api.Models;
using Rag.Api.Services;
using Rag.Api.Controllers;
using System.Text.Json;

if (args.Length != 2) throw new ArgumentException("Usage: Checks <repo-root> <one-page-scanned-pdf>");
var root = Path.GetFullPath(args[0]);
var config = new ConfigurationBuilder().AddJsonFile(Path.Combine(root, "Rag.Api/appsettings.Development.json"))
    .AddInMemoryCollection(new Dictionary<string,string?> {
        ["PdfOcr:ServiceUrl"] = "http://127.0.0.1:8090", ["PdfOcr:Device"] = "auto" }).Build();
var name = "ragyt_pdfchecks_" + Guid.NewGuid().ToString("N");
var connection = new NpgsqlConnectionStringBuilder(config.GetConnectionString("DefaultConnection")) { Database = "postgres" };
await using var admin = new NpgsqlConnection(connection.ConnectionString);
await admin.OpenAsync();
await new NpgsqlCommand($"CREATE DATABASE {name}", admin).ExecuteNonQueryAsync();
connection.Database = name;
var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connection.ConnectionString).Options;
try
{
    await using var db = new ApplicationDbContext(options);
    var migrator = db.GetService<IMigrator>();
    await migrator.MigrateAsync("20261114105612_RecordYoutubeTranscriptTiming");
    await db.Database.ExecuteSqlRawAsync("""
        INSERT INTO "PdfSources" ("Id","Name","FileName","Url","IsActive","Status","CreatedAt","UpdatedAt") VALUES (9001,'legacy','legacy.pdf','/legacy.pdf',true,1,now(),now());
        INSERT INTO "RagDocumentChunks" ("SourceType","SourceId","SourceName","Content","CreatedAt") VALUES (2,9001,'legacy','legacy chunk',now());
        """);
    await migrator.MigrateAsync();
    var legacy = await db.RagDocumentChunks.AsNoTracking().SingleAsync();
    Check(legacy.PdfSourceId == 9001 && legacy.Content == "legacy chunk", "migration backfills existing chunks without modifying content");
    var table = new string('x', 1600);
    var built = PdfOcrService.BuildPage(new PdfSource { Name="synthetic" }, 1,
        [new("Heading", "doc_title", [0,0,20,20]), new(new string('a',2000), "text", [0,21,200,200]), new(table,"table",[0,201,200,500])],
        "mineru-pipeline", "gpu:0", 300, 600);
    Check(built.Chunks.Count(x => x.Content == table) == 1, "table remains one complete semantic unit");
    foreach (var chunk in built.Chunks)
    {
        using var metadata = JsonDocument.Parse(chunk.MetadataJson!);
        var start = metadata.RootElement.GetProperty("startOffset").GetInt32();
        var end = metadata.RootElement.GetProperty("endOffset").GetInt32();
        Check(built.Text[start..end] == chunk.Content, "chunk offsets match stored page text");
    }
    var env = new CheckEnvironment { ContentRootPath = Path.Combine(Path.GetTempPath(), name) };
    Directory.CreateDirectory(env.ContentRootPath);
    using var httpServices = new ServiceCollection().AddHttpClient("MinerU", client => client.Timeout = Timeout.InfiniteTimeSpan).Services.BuildServiceProvider();
    var lifetime = new CheckLifetime();
    await using var speech = new GpuInferenceService(config, env, lifetime, NullLogger<GpuInferenceService>.Instance);
    var inference = new PdfLayoutInferenceService(config, env, lifetime, speech, NullLogger<PdfLayoutInferenceService>.Instance, httpServices.GetRequiredService<IHttpClientFactory>());
    var service = new PdfOcrService(env, db, inference);
    await using var input = File.OpenRead(args[1]);
    var uploaded = await service.UploadAndIngestAsync("scanned fixture", null, new FormFile(input,0,input.Length,"File","fixture.pdf"));
    Check(uploaded.chunkCount > 0, "real GPU OCR upload produces chunks");
    var sourceId = uploaded.source.Id;
    db.ChangeTracker.Clear();
    var page = await db.PdfPages.Include(x => x.Chunks).SingleAsync(x => x.PdfSourceId == sourceId);
    Check(page.Text.Any(char.IsLetterOrDigit) && page.Chunks.All(x => x.PdfSourceId == sourceId && x.PdfPageId == page.Id), "page text and foreign keys persisted");
    using (var metadata = JsonDocument.Parse(page.Chunks.First().MetadataJson!))
    {
        Check(metadata.RootElement.GetProperty("device").GetString() == "cuda", "actual OCR uses GPU");
        var assetId = metadata.RootElement.GetProperty("ocrAssetId").GetString()!;
        Check(Guid.TryParseExact(assetId,"N",out _), "preview uses an opaque asset ID");
        var image = File.ReadAllBytes(Path.Combine(env.ContentRootPath,"uploads/pdf/ocr",assetId,"page-1.png"));
        var controller = new SourceManagementController(db,null!,service);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        var action = await controller.GetPdfPageOverlay(sourceId,1,env,default);
        Check(action is OkObjectResult, "preview endpoint returns stored geometry and image");
        var overlay = (System.Text.Json.Nodes.JsonNode)((OkObjectResult)action).Value!;
        Check(overlay["width"]!.GetValue<int>() == System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(image.AsSpan(16,4)) &&
            overlay["height"]!.GetValue<int>() == System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(image.AsSpan(20,4)), "PNG size matches OCR coordinate frame");
        Check(overlay["detections"]!.AsArray().Count > 0, "line-level text detection polygons persisted");
        Check(await controller.GetPdfPageOverlay(9001,1,env,default) is NotFoundResult, "preview does not leak another source's page");
    }
    db.ChangeTracker.Clear();
    var backupScripts = Path.Combine(env.ContentRootPath,"scripts/backup");
    Directory.CreateDirectory(backupScripts);
    foreach (var script in Directory.EnumerateFiles(Path.Combine(root,"scripts/backup"),"*.ps1"))
        File.Copy(script,Path.Combine(backupScripts,Path.GetFileName(script)));
    var migrations = Path.Combine(env.ContentRootPath,"Rag.Api/Data/Migrations");
    Directory.CreateDirectory(migrations);
    foreach (var migration in Directory.EnumerateFiles(Path.Combine(root,"Rag.Api/Data/Migrations"),"*.cs"))
        File.Copy(migration,Path.Combine(migrations,Path.GetFileName(migration)));
    // The source root used by the copied backup script is its own isolated fixture directory.
    var backupPdfRoot = Path.Combine(env.ContentRootPath,"Rag.Api/uploads/pdf");
    Directory.CreateDirectory(backupPdfRoot);
    foreach (var file in Directory.EnumerateFiles(Path.Combine(env.ContentRootPath,"uploads/pdf")))
        File.Copy(file,Path.Combine(backupPdfRoot,Path.GetFileName(file)));
    File.Copy(args[1],Path.Combine(backupPdfRoot,"legacy.pdf"));
    var assetRoot = Path.Combine(env.ContentRootPath,"uploads/pdf/ocr");
    foreach (var assetDirectory in Directory.EnumerateDirectories(assetRoot))
    {
        var destination = Path.Combine(backupPdfRoot,"ocr",Path.GetFileName(assetDirectory));
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.EnumerateFiles(assetDirectory)) File.Copy(file,Path.Combine(destination,Path.GetFileName(file)));
    }
    var backupRoot = Path.Combine(env.ContentRootPath,"backups");
    await RunPowerShell(Path.Combine(backupScripts,"Backup-Local.ps1"),"-Database",name,"-BackupRoot",backupRoot);
    var backup = Directory.EnumerateDirectories(backupRoot).Single();
    await RunPowerShell(Path.Combine(backupScripts,"Test-Backup.ps1"),"-BackupPath",backup);
    using (var report = JsonDocument.Parse(File.ReadAllText(Path.Combine(backup,"restore-test.json"))))
        Check(report.RootElement.GetProperty("ocrPreviewPages").GetInt32() > 0, "backup restores referenced nested OCR preview assets");
    var source = await db.PdfSources.SingleAsync(x => x.Id == sourceId);
    var beforeIds = await db.RagDocumentChunks.Where(x => x.PdfSourceId == sourceId).Select(x => x.Id).ToArrayAsync();
    config["PdfOcr:ServiceUrl"] = "http://127.0.0.1:1";
    try { await service.RebuildAsync(source, default); throw new Exception("Expected OCR failure"); }
    catch (InvalidOperationException error) when (error.Message.Contains("service unavailable")) { }
    var afterIds = await db.RagDocumentChunks.Where(x => x.PdfSourceId == sourceId).Select(x => x.Id).ToArrayAsync();
    Check(beforeIds.SequenceEqual(afterIds), "OCR failure preserves existing chunks");
    using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
    try { await inference.ExtractAsync(args[1],[1],cancelled.Token); throw new Exception("Expected cancellation"); }
    catch (OperationCanceledException) { }
    Console.WriteLine("PASS: migration backfill, semantic chunks, page offsets, real GPU OCR upload, foreign keys, failure preservation and cancellation.");
}
finally
{
    NpgsqlConnection.ClearAllPools();
    if (!name.StartsWith("ragyt_pdfchecks_") || name.Length != 48) throw new Exception("Unsafe test database name");
    await new NpgsqlCommand($"DROP DATABASE {name} WITH (FORCE)",admin).ExecuteNonQueryAsync();
    Console.WriteLine("Removed isolated test database.");
}
static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
static async Task RunPowerShell(params string[] arguments)
{
    var info = new System.Diagnostics.ProcessStartInfo("powershell.exe") { UseShellExecute=false, CreateNoWindow=true,
        RedirectStandardOutput=true, RedirectStandardError=true };
    info.ArgumentList.Add("-NoProfile"); info.ArgumentList.Add("-File");
    foreach (var argument in arguments) info.ArgumentList.Add(argument);
    using var process = System.Diagnostics.Process.Start(info)!;
    var output = process.StandardOutput.ReadToEndAsync(); var error = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    if (process.ExitCode != 0) throw new Exception("Backup fixture check failed: " + await error + await output);
}
sealed class CheckEnvironment : IWebHostEnvironment
{
    public string ApplicationName { get; set; } = "checks";
    public string EnvironmentName { get; set; } = "Development";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = "";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
}
sealed class CheckLifetime : IHostApplicationLifetime
{
    public CancellationToken ApplicationStarted => CancellationToken.None;
    public CancellationToken ApplicationStopping => CancellationToken.None;
    public CancellationToken ApplicationStopped => CancellationToken.None;
    public void StopApplication() { }
}
