namespace Rag.Api.Models;

public class YoutubeTranscript
{
    public int Id { get; set; }
    public int YoutubeSourceId { get; set; }
    public YoutubeSource YoutubeSource { get; set; } = null!;
    public string VideoId { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string Origin { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string EngineVersion { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public double? ProcessingSeconds { get; set; }
    public double? DownloadSeconds { get; set; }
    public double? TranscriptionSeconds { get; set; }
    public double? TranslationSeconds { get; set; }
    public List<YoutubeTranscriptSegment> Segments { get; set; } = [];
}

public class YoutubeTranscriptSegment
{
    public int Id { get; set; }
    public int YoutubeTranscriptId { get; set; }
    public YoutubeTranscript YoutubeTranscript { get; set; } = null!;
    public int Sequence { get; set; }
    public double StartSeconds { get; set; }
    public double EndSeconds { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? TraditionalChineseText { get; set; }
}
