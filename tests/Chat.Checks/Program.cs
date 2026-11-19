using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.OpenApi.Writers;
using Rag.Api.Controllers;
using Rag.Api.DTOs;
using Swashbuckle.AspNetCore.Swagger;

if (args is ["--export", var path])
{
    // Build API descriptions without running Rag.Api.Program or touching the database/jobs.
    var builder = WebApplication.CreateBuilder();
    builder.Services.AddControllers().AddApplicationPart(typeof(ChatController).Assembly);
    builder.Services.AddSwaggerGen(options => {
        options.SwaggerDoc("v1", new() { Title = "RAG YT API", Version = "v1" });
        options.OperationFilter<Rag.Api.OpenApi.ApiDocumentationFilter>();
        options.SchemaFilter<Rag.Api.OpenApi.RequestDocumentationFilter>();
    });
    using var app = builder.Build(); app.MapControllers();
    var document = app.Services.GetRequiredService<ISwaggerProvider>().GetSwagger("v1");
    foreach (var key in document.Paths.Keys.Where(key => !key.StartsWith("/api/Chat")).ToArray()) document.Paths.Remove(key);
    using var file = File.CreateText(path); document.SerializeAsV3(new OpenApiJsonWriter(file));
    Console.WriteLine("Exported Chat OpenAPI without starting API or database.");
    return;
}

var handler = new FixtureHandler();
var controller = new ChatController(new FixtureFactory(handler), new ConfigurationBuilder().Build(), NullLogger<ChatController>.Instance);
var models = await controller.Models(default);
Check(models.Result is OkObjectResult { Value: ChatModelsResponse { Models.Count: 1 } }, "installed models");
var request = new ChatRequest { Model = "gemma4:12b", Messages = [new() { Role = "user", Content = "こんにちは" }] };
var answer = await controller.Send(request, default);
Check(answer.Result is OkObjectResult { Value: ChatResponse { Model: "gemma4:12b", Content: "你好" } }, "assistant response");
Check(handler.Payload!.Contains("gemma4:12b") && handler.Payload.Contains("\"stream\":false") && handler.Payload.Contains("\"keep_alive\":\"0\""), "model / non-stream / release GPU");
request.Messages[0].Role = "assistant";
Check((await controller.Send(request, default)).Result is BadRequestObjectResult, "last message must be user");
request.Messages[0].Role = "user";
handler.Status = HttpStatusCode.NotFound;
Check((await controller.Send(request, default)).Result is NotFoundObjectResult, "missing model");
handler.Status = HttpStatusCode.ServiceUnavailable;
Check((await controller.Models(default)).Result is ObjectResult { StatusCode: 503 }, "offline status");
handler.Status = HttpStatusCode.OK; handler.Hold = true;
using var cancellation = new CancellationTokenSource(20);
try { await controller.Send(request, cancellation.Token); throw new Exception("Cancellation was ignored"); }
catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
Console.WriteLine("PASS: models, selected model, response, validation, offline, cancellation. No database or live inference used.");

static void Check(bool value, string label) { if (!value) throw new Exception(label); }
sealed class FixtureFactory(FixtureHandler handler) : IHttpClientFactory
{ public HttpClient CreateClient(string name) => new(handler, disposeHandler: false); }
sealed class FixtureHandler : HttpMessageHandler
{
    public HttpStatusCode Status = HttpStatusCode.OK;
    public string? Payload;
    public bool Hold;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        if (Hold) await Task.Delay(10000, token);
        Payload = request.Content is null ? null : await request.Content.ReadAsStringAsync(token);
        return new(Status) { Content = new StringContent(request.Method == HttpMethod.Get ? """{"models":[{"name":"gemma4:12b"}]}""" : """{"model":"gemma4:12b","message":{"content":"你好"}}""", Encoding.UTF8, "application/json") };
    }
}
