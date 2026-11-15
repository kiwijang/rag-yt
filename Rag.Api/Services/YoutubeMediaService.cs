using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Rag.Api.Services;

/// <summary>C# owns external media tools. No Python subprocess is used for downloading or metadata.</summary>
public sealed class YoutubeMediaService(IConfiguration configuration, ILogger<YoutubeMediaService> logger)
{
    public async Task<JsonDocument> ReadMetadataAsync(string url, bool channel, CancellationToken cancellationToken)
    {
        var args = new[] { "--ignore-config", channel ? "--flat-playlist" : "--no-playlist", "--skip-download",
            "--dump-single-json", "--no-progress", "--encoding", "utf-8", "--js-runtimes",
            configuration["Transcription:JsRuntime"] ?? "node", "--", url };
        var result = await RunAsync(configuration["Transcription:YtDlpExecutable"] ?? "yt-dlp", args, cancellationToken);
        if (result.ExitCode != 0) throw new MediaCommandException(result.Error);
        return JsonDocument.Parse(result.Output);
    }

    public async Task<string> DownloadAudioAsync(string videoId, string directory, CancellationToken cancellationToken)
    {
        var raw = Path.Combine(directory, "youtube-audio");
        var download = await RunAsync(configuration["Transcription:YtDlpExecutable"] ?? "yt-dlp", new[]
        {
            "--ignore-config", "--no-playlist", "--no-progress", "--write-info-json", "--js-runtimes",
            configuration["Transcription:JsRuntime"] ?? "node", "--format", "bestaudio/best",
            "--max-filesize", "200M", "--match-filter", "!is_live & !is_upcoming",
            "--output", raw, "--", $"https://www.youtube.com/watch?v={videoId}"
        }, cancellationToken);
        if (download.ExitCode != 0 || !File.Exists(raw) || new FileInfo(raw).Length == 0)
        {
            logger.LogWarning("yt-dlp audio download failed: {Diagnostics}", download.Error);
            throw new TranscriptionException("download", download.Error.Contains("members", StringComparison.OrdinalIgnoreCase)
                ? "This video requires channel membership."
                : "yt-dlp could not download audio. Check video access, Node.js and the API log.");
        }
        var wav = Path.Combine(directory, "audio.wav");
        var decode = await RunAsync(configuration["Transcription:FfmpegExecutable"] ?? "ffmpeg", new[]
        {
            "-nostdin", "-v", "error", "-i", raw, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-y", wav
        }, cancellationToken);
        if (decode.ExitCode != 0 || !File.Exists(wav) || new FileInfo(wav).Length <= 44)
        {
            logger.LogWarning("FFmpeg audio decode failed: {Diagnostics}", decode.Error);
            throw new TranscriptionException("download", "FFmpeg could not prepare mono 16 kHz audio. Check the audio and API log.");
        }
        return wav;
    }

    public static async Task<(string? Availability, double? Duration)> ReadDownloadMetadataAsync(string audioPath, CancellationToken token)
    {
        var file = Directory.EnumerateFiles(Path.GetDirectoryName(audioPath)!, "*.info.json").FirstOrDefault();
        if (file is null) return (null, null);
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(file, token));
        var root = document.RootElement;
        var availability = root.TryGetProperty("availability", out var access) && access.ValueKind == JsonValueKind.String ? access.GetString() : null;
        double? duration = root.TryGetProperty("duration", out var length) && length.ValueKind == JsonValueKind.Number && length.TryGetDouble(out var seconds) && seconds >= 0 && double.IsFinite(seconds) ? seconds : null;
        return (availability, duration);
    }

    private async Task<CommandResult> RunAsync(string executable, IEnumerable<string> arguments, CancellationToken cancellationToken)
    {
        var info = new ProcessStartInfo(executable)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
        };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var process = new Process { StartInfo = info };
        try { process.Start(); }
        catch (System.ComponentModel.Win32Exception error)
        { throw new MediaCommandException($"Could not start {Path.GetFileName(executable)}. Install the standalone tool or configure its executable path.", error); }
        var output = process.StandardOutput.ReadToEndAsync();
        var errorOutput = process.StandardError.ReadToEndAsync();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromMinutes(15));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
            await process.WaitForExitAsync(CancellationToken.None);
            await Task.WhenAll(output, errorOutput);
            throw;
        }
        return new(process.ExitCode, await output, await errorOutput);
    }
    private sealed record CommandResult(int ExitCode, string Output, string Error);
}

public sealed class MediaCommandException(string message, Exception? inner = null) : Exception(message, inner);
