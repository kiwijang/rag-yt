using System.Text.Json;
using Rag.Api.Models;

namespace Rag.Api.Services;

public static class YoutubeSearchChunks
{
    private const int TargetSeconds = 30;
    private const int MaxSeconds = 60;
    private const int MaxCharacters = 400;
    private const int PauseSeconds = 3;

    public static IEnumerable<RagDocumentChunk> Build(YoutubeTranscript transcript, string sourceName)
    {
        var segments = transcript.Segments.OrderBy(segment => segment.Sequence).ToArray();
        var start = 0;
        while (start < segments.Length)
        {
            var end = start;
            var text = new List<string> { SearchText(segments[start]) };
            var length = text[0].Length;
            while (end + 1 < segments.Length)
            {
                var next = segments[end + 1];
                var current = segments[end];
                var nextText = SearchText(next);
                if (next.StartSeconds - current.EndSeconds >= PauseSeconds ||
                    next.EndSeconds - segments[start].StartSeconds > MaxSeconds ||
                    length + 1 + nextText.Length > MaxCharacters ||
                    (current.EndSeconds - segments[start].StartSeconds >= TargetSeconds &&
                     text[^1].TrimEnd().EndsWithAnySentenceMark()))
                    break;

                text.Add(nextText);
                length += 1 + nextText.Length;
                end++;
            }

            yield return new RagDocumentChunk
            {
                SourceType = SourceType.YouTube,
                SourceId = transcript.YoutubeSourceId,
                SourceName = sourceName,
                Content = string.Join(" ", text),
                YoutubeTranscriptSegment = segments[start],
                MetadataJson = JsonSerializer.Serialize(new
                {
                    firstSequence = segments[start].Sequence,
                    lastSequence = segments[end].Sequence,
                    endSeconds = segments.Skip(start).Take(end - start + 1).Max(segment => segment.EndSeconds)
                }),
                CreatedAt = transcript.CreatedAt
            };
            start = end + 1;
        }
    }

    public static double EndSeconds(RagDocumentChunk chunk)
    {
        if (chunk.MetadataJson is null) return chunk.YoutubeTranscriptSegment!.EndSeconds;
        using var data = JsonDocument.Parse(chunk.MetadataJson);
        return data.RootElement.TryGetProperty("endSeconds", out var end)
            ? end.GetDouble()
            : chunk.YoutubeTranscriptSegment!.EndSeconds;
    }

    private static string SearchText(YoutubeTranscriptSegment segment) =>
        (string.IsNullOrWhiteSpace(segment.TraditionalChineseText) ? segment.Text : segment.TraditionalChineseText).Trim();

    private static bool EndsWithAnySentenceMark(this string text) =>
        text.Length > 0 && "。！？.!?…".Contains(text[^1]);
}
