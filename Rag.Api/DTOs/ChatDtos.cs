using System.ComponentModel.DataAnnotations;

namespace Rag.Api.DTOs;

public sealed class ChatMessage
{
    [Required, RegularExpression("^(user|assistant)$")]
    public string Role { get; set; } = "user";
    [Required, StringLength(12000, MinimumLength = 1)]
    public string Content { get; set; } = "";
}

public sealed class ChatRequest
{
    [Required, StringLength(200)]
    public string Model { get; set; } = "";
    [Required, MinLength(1), MaxLength(40)]
    public List<ChatMessage> Messages { get; set; } = [];
}

public sealed record ChatModel(string Name);
public sealed record ChatModelsResponse(IReadOnlyList<ChatModel> Models);
public sealed record ChatResponse(string Model, string Content);
