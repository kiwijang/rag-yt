namespace Rag.Api.Models;

public enum SourceType
{
    YouTube = 1,
    Pdf = 2
}

public enum SourceStatus
{
    Draft = 0,
    Active = 1,
    Paused = 2,
    Error = 3
}

public enum YoutubeSyncMode
{
    Channel = 1,
    Video = 2
}

public class YoutubeSource
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ChannelId { get; set; } = string.Empty;
    public string? ChannelName { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public SourceStatus Status { get; set; } = SourceStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class PdfSource
{
    public ICollection<PdfPage> Pages { get; set; } = new List<PdfPage>();
    public ICollection<RagDocumentChunk> Chunks { get; set; } = new List<RagDocumentChunk>();
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public SourceStatus Status { get; set; } = SourceStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class PdfPage
{
    public int Id { get; set; }
    public int PdfSourceId { get; set; }
    public PdfSource PdfSource { get; set; } = null!;
    public int PageNumber { get; set; }
    public string Text { get; set; } = string.Empty;
    public ICollection<RagDocumentChunk> Chunks { get; set; } = new List<RagDocumentChunk>();
}

public class RagDocumentChunk
{
    public int Id { get; set; }
    public SourceType SourceType { get; set; }
    public int SourceId { get; set; }
    public string SourceName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? MetadataJson { get; set; }
    public int? PdfSourceId { get; set; }
    public PdfSource? PdfSource { get; set; }
    public int? PdfPageId { get; set; }
    public PdfPage? PdfPage { get; set; }
    public int? YoutubeTranscriptSegmentId { get; set; }
    public YoutubeTranscriptSegment? YoutubeTranscriptSegment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
