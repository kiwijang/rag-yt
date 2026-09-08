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

public class RagDocumentChunk
{
    public int Id { get; set; }
    public SourceType SourceType { get; set; }
    public int SourceId { get; set; }
    public string SourceName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? MetadataJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
