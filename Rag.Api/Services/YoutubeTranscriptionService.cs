using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public class YoutubeTranscriptionService(
    ApplicationDbContext db,
    IConfiguration configuration,
    ILogger<YoutubeTranscriptionService> logger,
    YoutubeMediaService media,
    GpuInferenceService inference,
    YoutubeVideoMetadataStore metadata)
{

    public static string? GetVideoId(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http"))
            return null;

        var path = uri.AbsolutePath.Trim('/').Split('/');
        var id = uri.Host.ToLowerInvariant() switch
        {
            "youtu.be" when path.Length == 1 => path[0],
            "youtube.com" or "www.youtube.com" or "m.youtube.com" => path switch
            {
                ["watch"] when QueryHelpers.ParseQuery(uri.Query).TryGetValue("v", out var value) => value.ToString(),
                ["shorts" or "live" or "embed", var videoId] => videoId,
                _ => null
            },
            _ => null
        };
        return id is not null && Regex.IsMatch(id, @"\A[A-Za-z0-9_-]{11}\z") ? id : null;
    }

    public async Task<YoutubeTranscript> TranscribeAsync(
        YoutubeSource source, string videoId, string? language, CancellationToken cancellationToken,
        Action<string>? reportStage = null)
    {
        var startedAt = Stopwatch.GetTimestamp();
        var model = configuration["Transcription:Model"] ?? "large-v2";
        var directory = Directory.CreateTempSubdirectory("ragyt-transcription-");
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromMinutes(30));
            reportStage?.Invoke("download");
            var downloadStart = Stopwatch.GetTimestamp();
            string audioPath;
            try { audioPath = await media.DownloadAudioAsync(videoId, directory.FullName, timeout.Token); }
            catch (MediaCommandException error) { throw new TranscriptionException("download", error.Message); }
            var downloadSeconds = Stopwatch.GetElapsedTime(downloadStart).TotalSeconds;
            try
            {
                var details = await YoutubeMediaService.ReadDownloadMetadataAsync(audioPath, timeout.Token);
                await metadata.PersistAsync(source.Id, videoId, details.Availability, details.Duration, timeout.Token);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            { logger.LogWarning(error, "Could not persist download metadata for {VideoId}", videoId); }
            var result = await inference.InferAsync(audioPath, language, reportStage, timeout.Token);
            reportStage?.Invoke("saving");
            if (result.Segments is not { Count: > 0 })
                throw new TranscriptionException("transcription", "No speech was detected in the YouTube video.");

            var now = DateTime.UtcNow;
            var transcript = new YoutubeTranscript
            {
                YoutubeSourceId = source.Id,
                VideoId = videoId,
                Language = result.Language,
                Origin = "faster-whisper",
                Model = model,
                EngineVersion = result.EngineVersion,
                DownloadSeconds = downloadSeconds,
                TranscriptionSeconds = result.TranscriptionSeconds,
                TranslationSeconds = result.TranslationSeconds,
                CreatedAt = now
            };

            foreach (var item in result.Segments)
            {
                var segment = new YoutubeTranscriptSegment
                {
                    Sequence = transcript.Segments.Count + 1,
                    StartSeconds = item.StartSeconds,
                    EndSeconds = item.EndSeconds,
                    Text = item.Text,
                    TraditionalChineseText = item.TraditionalChineseText
                };
                transcript.Segments.Add(segment);
            }

            db.RagDocumentChunks.AddRange(YoutubeSearchChunks.Build(transcript, source.Name));
            transcript.ProcessingSeconds = Stopwatch.GetElapsedTime(startedAt).TotalSeconds;
            db.YoutubeTranscripts.Add(transcript);
            await db.SaveChangesAsync(cancellationToken);
            return transcript;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TranscriptionException("timeout", "Download and inference exceeded 30 minutes.");
        }
        finally
        {
            try
            {
                foreach (var file in directory.EnumerateFiles())
                    file.Delete();
                directory.Delete();
            }
            catch (IOException ex)
            {
                logger.LogWarning(ex, "Could not clean up the temporary transcription directory.");
            }
            catch (UnauthorizedAccessException ex)
            {
                logger.LogWarning(ex, "Could not clean up the temporary transcription directory.");
            }
        }
    }

}

public sealed class TranscriptionException(string stage, string message) : Exception(message)
{
    public string Stage { get; } = stage;
}
