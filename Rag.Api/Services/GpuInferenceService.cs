using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Rag.Api.Services;

/// <summary>One managed, persistent inference process; models are reused across videos.</summary>
public sealed class GpuInferenceService(IConfiguration configuration, IHostEnvironment environment,
    IHostApplicationLifetime lifetime, ILogger<GpuInferenceService> logger) : IHostedService, IAsyncDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly ConcurrentQueue<string> diagnostics = new();
    private Process? worker;
    private Task? stderrTask;
    private int disposed;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask; // Lazy: no model download on API startup.

    public async Task<T> WithExternalInferenceAsync<T>(Func<Task<T>> action, CancellationToken token)
    {
        await gate.WaitAsync(token);
        try
        {
            // Serializing alone is insufficient: cached Whisper/NLLB weights still occupy CUDA memory.
            await ResetAsync();
            return await action();
        }
        finally { gate.Release(); }
    }
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        // ApplicationStopping cancels an active request; killing also unblocks a stalled native inference.
        KillWorker();
        await gate.WaitAsync(CancellationToken.None);
        try { await ResetAsync(); } finally { gate.Release(); }
    }

    public async Task<InferenceResult> InferAsync(string audioPath, string? language,
        Action<string>? reportStage, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.ApplicationStopping);
        timeout.CancelAfter(TimeSpan.FromMinutes(30));
        await gate.WaitAsync(timeout.Token);
        try
        {
            await EnsureWorkerAsync(timeout.Token);
            var id = Guid.NewGuid().ToString("N");
            await worker!.StandardInput.WriteLineAsync(JsonSerializer.Serialize(new { id, audioPath, language }, Json).AsMemory(), timeout.Token);
            await worker.StandardInput.FlushAsync(timeout.Token);
            while (true)
            {
                var message = await ReadMessageAsync(timeout.Token);
                if (!message.TryGetProperty("id", out var requestId) || requestId.GetString() != id)
                    throw new TranscriptionException("process", "Inference worker returned an unexpected request ID.");
                switch (message.GetProperty("type").GetString())
                {
                    case "stage": reportStage?.Invoke(message.GetProperty("stage").GetString()!); break;
                    case "result":
                        var result = message.GetProperty("result").Deserialize<InferenceResult>(Json)
                            ?? throw new TranscriptionException("process", "Inference returned no result.");
                        logger.LogInformation("Inference completed: Whisper={Whisper}, translation={Translation}, model loads={WhisperLoads}/{TranslationLoads}",
                            result.WhisperDevice, result.TranslationDevice, result.WhisperLoads, result.TranslationLoads);
                        return result;
                    case "error":
                        logger.LogWarning("Inference failed: {Message}", message.GetProperty("message").GetString());
                        throw new TranscriptionException(message.GetProperty("stage").GetString() ?? "process",
                            "GPU inference failed. Review the API log for the model or CUDA error.");
                    default: throw new TranscriptionException("process", "Unknown inference response.");
                }
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && !lifetime.ApplicationStopping.IsCancellationRequested)
        {
            await ResetAsync();
            throw new TranscriptionException("timeout", "Inference exceeded 30 minutes.");
        }
        catch { await ResetAsync(); throw; } // Never reuse a protocol stream after cancellation/failure.
        finally { gate.Release(); }
    }

    private async Task EnsureWorkerAsync(CancellationToken cancellationToken)
    {
        if (worker is { HasExited: false }) return;
        await ResetAsync();
        var venv = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", ".venv",
            OperatingSystem.IsWindows() ? "Scripts/python.exe" : "bin/python"));
        var info = new ProcessStartInfo(configuration["Transcription:PythonExecutable"] ?? venv)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        info.Environment["PYTHONUTF8"] = "1";
        var device = configuration["Transcription:Device"] ?? "cpu";
        var script = configuration["Transcription:InferenceScript"] ?? Path.Combine(AppContext.BaseDirectory, "Scripts", "inference_worker.py");
        foreach (var argument in new[] { "-u", script,
            "--model", configuration["Transcription:Model"] ?? "large-v2", "--device", device,
            "--compute-type", configuration["Transcription:ComputeType"] ?? (device == "cuda" ? "float16" : "int8"),
            "--translation-device", configuration["Transcription:TranslationDevice"] ?? device,
            "--translation-batch-size", Math.Clamp(configuration.GetValue("Transcription:TranslationBatchSize", 8), 1, 32).ToString(),
            "--cpu-threads", Math.Clamp(configuration.GetValue("Transcription:CpuThreads", 4), 1, Environment.ProcessorCount).ToString() })
            info.ArgumentList.Add(argument);
        worker = new Process { StartInfo = info };
        try { worker.Start(); }
        catch (System.ComponentModel.Win32Exception error)
        {
            worker.Dispose();
            worker = null;
            throw new TranscriptionException("setup", $"Could not start inference Python: {error.Message}");
        }
        stderrTask = ReadDiagnosticsAsync(worker.StandardError);
        var ready = await ReadMessageAsync(cancellationToken);
        if (ready.GetProperty("type").GetString() != "ready")
            throw new TranscriptionException("setup", ready.TryGetProperty("message", out var error) ? error.GetString()! : "Inference initialization failed.");
        logger.LogInformation("Persistent inference worker started, PID {Pid}, Whisper={Device}, translation={TranslationDevice}",
            worker.Id, device, configuration["Transcription:TranslationDevice"] ?? device);
    }

    private async Task<JsonElement> ReadMessageAsync(CancellationToken cancellationToken)
    {
        var line = await worker!.StandardOutput.ReadLineAsync(cancellationToken);
        if (line is null)
        {
            logger.LogWarning("Inference worker closed its output: {Diagnostics}", string.Join("\n", diagnostics));
            throw new TranscriptionException("process", "Inference process exited unexpectedly; review the API log.");
        }
        using var document = JsonDocument.Parse(line);
        return document.RootElement.Clone();
    }
    private async Task ReadDiagnosticsAsync(StreamReader reader)
    {
        while (await reader.ReadLineAsync() is { } line)
        {
            diagnostics.Enqueue(line);
            while (diagnostics.Count > 30) diagnostics.TryDequeue(out _);
            logger.LogInformation("Inference: {Diagnostic}", line);
        }
    }
    private void KillWorker()
    {
        try { if (worker is { HasExited: false }) worker.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { }
    }
    private async Task ResetAsync()
    {
        KillWorker();
        if (worker is not null)
        {
            await worker.WaitForExitAsync(CancellationToken.None);
            if (stderrTask is not null) { await stderrTask; stderrTask = null; }
            worker.Dispose();
            worker = null;
        }
        if (stderrTask is not null) { await stderrTask; stderrTask = null; }
        diagnostics.Clear();
    }
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        await ResetAsync();
        gate.Dispose();
    }
}

public sealed record InferenceResult(string Language, string EngineVersion, List<InferenceSegment> Segments,
    double TranscriptionSeconds, double TranslationSeconds, string WhisperDevice, string TranslationDevice,
    int WhisperLoads, int TranslationLoads);
public sealed record InferenceSegment(double StartSeconds, double EndSeconds, string Text, string TraditionalChineseText);
