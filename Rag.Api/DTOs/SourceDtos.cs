namespace Rag.Api.DTOs;

using Microsoft.AspNetCore.Http;
using Rag.Api.Models;

public class CreateYoutubeSourceRequest
{
    public string Name { get; set; } = string.Empty;
    public string ChannelId { get; set; } = string.Empty;
    public string? ChannelName { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateYoutubeSourceRequest
{
    public string? Name { get; set; }
    public string? ChannelId { get; set; }
    public string? ChannelName { get; set; }
    public string? Url { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
    public int? Status { get; set; }
}

public class CreatePdfSourceRequest
{
    public string Name { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdatePdfSourceRequest
{
    public string? Name { get; set; }
    public string? FileName { get; set; }
    public string? Url { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
    public int? Status { get; set; }
}

public class SyncYoutubeSourceRequest
{
    public string Mode { get; set; } = "channel";
    public int Take { get; set; } = 10;
}

public class UploadPdfSourceRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public IFormFile? File { get; set; }
}

public class RagSearchRequest
{
    /// <summary>hybrid: BGE-M3 dense + Weaviate BM25; vector: dense only; keyword: PostgreSQL substring.</summary>
    public string Mode { get; set; } = "hybrid";
    /// <summary>Also search PDF page images using Jina CLIP v2 text-to-image embeddings.</summary>
    public bool IncludeImages { get; set; } = true;
    public string Query { get; set; } = string.Empty;
    public SourceType? SourceType { get; set; }
    public int? SourceId { get; set; }
    public int Take { get; set; } = 20;
}
