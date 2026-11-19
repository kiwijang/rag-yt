using System.Text.Json;
using System.Text.Json.Nodes;
using Rag.Api.Models;

namespace Rag.Api.Services;

public static class TranscriptEmbeddingText
{
    public const string Original = "original";
    public const string EditedOriginal = "original-edited";

    public static string Read(RagDocumentChunk chunk)
    {
        var first = chunk.YoutubeTranscriptSegment ?? throw new VectorServiceException("Transcript segment is required for original-language embeddings.");
        using var metadata = JsonDocument.Parse(chunk.MetadataJson ?? "{}");
        var root = metadata.RootElement;
        if (root.TryGetProperty("textSource", out var source) && source.ValueKind == JsonValueKind.String &&
            source.GetString() is Original or EditedOriginal) return chunk.Content.Trim();
        var start = first.Sequence; var end = start;
        if (root.TryGetProperty("firstSequence", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) start = number;
        if (root.TryGetProperty("lastSequence", out value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out number)) end = number;
        if (start != first.Sequence || end < start) throw new VectorServiceException($"Chunk {chunk.Id} has an invalid original segment range.");
        var segments = first.YoutubeTranscript.Segments.Where(s => s.Sequence >= start && s.Sequence <= end).OrderBy(s => s.Sequence).ToArray();
        if (segments.Length == 0 && start == end) segments = [first];
        if (segments.Length != end - start + 1) throw new VectorServiceException($"Original segments are missing for chunk {chunk.Id}; stored text was preserved.");
        // Never substitute machine translation for missing source text.
        return string.Join(" ", segments.Select(s => s.Text.Trim()));
    }

    public static string MarkEditedOriginal(string? metadata)
    {
        var root = JsonNode.Parse(metadata ?? "{}")!.AsObject(); root["textSource"] = EditedOriginal;
        return root.ToJsonString();
    }
}
