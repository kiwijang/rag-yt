using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Rag.Api.Data;
using Rag.Api.Models;
using Rag.Api.Services;

var root=Path.GetFullPath(args.Length==0?".":args[0]);
var config=new ConfigurationBuilder().AddJsonFile(Path.Combine(root,"Rag.Api/appsettings.Development.json"))
    .AddInMemoryCollection(new Dictionary<string,string?>{{"Embeddings:IndexDevice","cpu"}}).Build();
var database="ragyt_chunkchecks_"+Guid.NewGuid().ToString("N");
var cs=new NpgsqlConnectionStringBuilder(config.GetConnectionString("DefaultConnection")){Database="postgres"};
await using var admin=new NpgsqlConnection(cs.ConnectionString);await admin.OpenAsync();
await new NpgsqlCommand($"CREATE DATABASE {database}",admin).ExecuteNonQueryAsync();
cs.Database=database;
var options=new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(cs.ConnectionString).Options;
try
{
    await using var db=new ApplicationDbContext(options);await db.Database.MigrateAsync();
    var source=new YoutubeSource{Name="fixture",Url="https://example.invalid"};db.Add(source);await db.SaveChangesAsync();
    var version=new YoutubeTranscript{YoutubeSourceId=source.Id,VideoId="fixture0001",Language="zh",CreatedAt=DateTime.UtcNow,
        Segments=[new(){Sequence=1,StartSeconds=0,EndSeconds=2,Text="original"}]};
    db.Add(version);await db.SaveChangesAsync();
    var chunk=new RagDocumentChunk{SourceType=SourceType.YouTube,SourceId=source.Id,SourceName="fixture",Content="original",
        YoutubeTranscriptSegmentId=version.Segments[0].Id,CreatedAt=DateTime.UtcNow};db.Add(chunk);await db.SaveChangesAsync();
    var id=chunk.Id;db.ChangeTracker.Clear();
    using var http=new FakeHttp();var transport=new FakeFactory(http);
    var vectors=new WeaviateVectorStore(transport,config);
    using var provider=new ServiceCollection().BuildServiceProvider();
    var lifetime=new CheckLifetime();var env=new CheckEnvironment{ContentRootPath=Path.Combine(root,"Rag.Api")};
    await using var gpu=new GpuInferenceService(config,env,lifetime,NullLogger<GpuInferenceService>.Instance);
    var bge=new BgeEmbeddingService(transport,config,gpu,lifetime,NullLogger<BgeEmbeddingService>.Instance);
    using var queue=new YoutubeTranscriptQueue(provider.GetRequiredService<IServiceScopeFactory>(),config,NullLogger<YoutubeTranscriptQueue>.Instance);
    var service=new TranscriptChunkManagementService(db,queue,bge,vectors,NullLogger<TranscriptChunkManagementService>.Instance);
    async Task<VectorDocument> Current() => RagVectorDocuments.Build((await RagVectorDocuments.LoadAsync(db,db.RagDocumentChunks.AsNoTracking().Where(c=>c.Id==id),default)).Single());
    var original=await Current();
    await vectors.UpsertAsync(WeaviateVectorStore.TextClass,id,1,source.Id,null,original.Content,original.ContentHash,original.ModelKey,FakeHttp.Vector,default);
    var saved=await service.UpdateAsync(source.Id,version.Id,id,"edited","original",default);
    Check(saved.EmbeddingUpdated&&!saved.CleanupPending,"combined save reports embedding success");
    Check((await Current()).Content=="edited"&&http.Objects.Count==1,"SQL commit switches revision and cleans old vector");
    var stableHash=(await Current()).ContentHash;
    http.FailEmbedding=true;
    await Expect503(()=>service.UpdateAsync(source.Id,version.Id,id,"embedding failure","edited",default));http.FailEmbedding=false;
    Check((await Current()).Content=="edited"&&http.Objects.Count==1,"embedding failure preserves SQL and old vector");
    http.FailWrite=true;
    await Expect503(()=>service.UpdateAsync(source.Id,version.Id,id,"write failure","edited",default));http.FailWrite=false;
    Check((await Current()).Content=="edited"&&http.Objects.Count==1,"Weaviate failure preserves SQL and old vector");
    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"RagDocumentChunks\" ADD CONSTRAINT fixture_reject CHECK (\"Content\" <> 'FAIL-SQL')");
    try {await service.UpdateAsync(source.Id,version.Id,id,"FAIL-SQL","edited",default);throw new Exception("Expected SQL rejection");}
    catch(PostgresException error) when(error.SqlState=="23514") { }
    Check((await Current()).Content=="edited"&&http.Objects.Values.Any(o=>o["properties"]!["contentHash"]!.GetValue<string>()==stableHash),"SQL failure after staging preserves old searchable revision");
    var semantic=new RagSemanticSearchService(db,vectors,bge,new JinaEmbeddingService(transport,config,gpu),env);
    var hits=await semantic.SearchAsync("query",SourceType.YouTube,source.Id,20,false,true,default);
    Check(hits.Count==1,"staged failed revision excluded from actual semantic search");
    await vectors.PruneTextAsync(new(){{id,stableHash}},1,source.Id,null,null,default);
    Check(http.Objects.Count==1,"reconciliation removes uncommitted staged vector");
    var before=http.EmbeddingCalls;
    try {await service.UpdateAsync(source.Id,version.Id,id,"conflict","outdated",default);throw new Exception("Expected conflict");}
    catch(TranscriptManagementException error) when(error.StatusCode==409) { }
    Check(http.EmbeddingCalls==before,"optimistic conflict detected before inference");
    await using(var locker=new NpgsqlConnection(cs.ConnectionString))
    {
        await locker.OpenAsync();await new NpgsqlCommand("SELECT pg_advisory_lock(681240133)",locker).ExecuteScalarAsync();
        try
        {
            try {await service.UpdateAsync(source.Id,version.Id,id,"busy","edited",default);throw new Exception("Expected index lock conflict");}
            catch(TranscriptManagementException error) when(error.StatusCode==409) { }
            Check(http.EmbeddingCalls==before,"concurrent index writer rejected before inference");
        }
        finally {await new NpgsqlCommand("SELECT pg_advisory_unlock(681240133)",locker).ExecuteScalarAsync();}
    }
    http.FailDelete=true;
    saved=await service.UpdateAsync(source.Id,version.Id,id,"next edit","edited",default);http.FailDelete=false;
    Check(saved.EmbeddingUpdated&&saved.CleanupPending&&(await Current()).Content=="next edit","cleanup failure does not falsely report a rollback after commit");
    hits=await semantic.SearchAsync("query",SourceType.YouTube,source.Id,20,false,true,default);
    Check(hits.Count==1,"old revision excluded while cleanup pending");
    var japanese=new YoutubeTranscript{YoutubeSourceId=source.Id,VideoId="fixture0002",Language="ja",CreatedAt=DateTime.UtcNow,
        Segments=[new(){Sequence=1,StartSeconds=0,EndSeconds=2,Text="骨盤を安定させます。",TraditionalChineseText="錯誤譯文一"},
            new(){Sequence=2,StartSeconds=2,EndSeconds=4,Text="片脚で立ってください。",TraditionalChineseText="錯誤譯文二"},
            new(){Sequence=3,StartSeconds=4,EndSeconds=6,Text="姿勢を保ちます。",TraditionalChineseText="錯誤譯文三"}]};
    db.Add(japanese);await db.SaveChangesAsync();
    var legacy=new RagDocumentChunk{SourceType=SourceType.YouTube,SourceId=source.Id,SourceName="fixture",Content="錯誤譯文與手動註記，必須保留",
        YoutubeTranscriptSegmentId=japanese.Segments[0].Id,MetadataJson="{\"firstSequence\":1,\"lastSequence\":2,\"endSeconds\":4}",CreatedAt=DateTime.UtcNow};
    db.Add(legacy);await db.SaveChangesAsync();var legacyId=legacy.Id;var originalMetadata=legacy.MetadataJson;var originalStored=legacy.Content;db.ChangeTracker.Clear();
    async Task<VectorDocument> Japanese() => RagVectorDocuments.Build((await RagVectorDocuments.LoadAsync(db,db.RagDocumentChunks.AsNoTracking().Where(c=>c.Id==legacyId),default)).Single());
    var japaneseDoc=await Japanese();
    Check(japaneseDoc.Content=="骨盤を安定させます。 片脚で立ってください。"&&!japaneseDoc.Input.Contains("錯誤譯文"),"legacy multi-segment chunk embeds Japanese source range, never translated content");
    Check(japaneseDoc.ModelKey==RagVectorDocuments.OriginalTranscriptModelKey,"original-language transcript index has a distinct version");
    var view=await service.ListAsync(source.Id,japanese.Id,default);
    Check(view.Chunks.Single().Content==originalStored&&view.Chunks.Single().EmbeddingText==japaneseDoc.Content,"editor exposes original embedding text while preserving stored manual notes");
    var secondId=japanese.Segments[1].Id;
    await db.YoutubeTranscriptSegments.Where(s=>s.Id==secondId).ExecuteUpdateAsync(set=>set.SetProperty(s=>s.TraditionalChineseText,"另一個錯誤譯文"));
    Check((await Japanese()).ContentHash==japaneseDoc.ContentHash,"translation-only changes cannot alter original embeddings");
    await db.YoutubeTranscriptSegments.Where(s=>s.Id==secondId).ExecuteUpdateAsync(set=>set.SetProperty(s=>s.Text,"片脚でゆっくり立ってください。"));
    Check((await Japanese()).ContentHash!=japaneseDoc.ContentHash,"original transcript corrections invalidate their vector hash");
    Check(await db.RagDocumentChunks.Where(c=>c.Id==legacyId).Select(c=>c.Content).SingleAsync()==originalStored&&
        await db.RagDocumentChunks.Where(c=>c.Id==legacyId).Select(c=>c.MetadataJson).SingleAsync()==originalMetadata,"reading/index preparation does not rewrite legacy chunk content or metadata");
    var newChunks=YoutubeSearchChunks.Build(japanese,"fixture").ToArray();
    Check(newChunks.All(c=>!c.Content.Contains("錯誤譯文")&&c.MetadataJson!.Contains("original")),"new chunks store original language with provenance");
    var editedJapanese="骨盤を安定させる筋肉です。";
    await service.UpdateAsync(source.Id,japanese.Id,legacyId,editedJapanese,originalStored,default);
    Check((await Japanese()).Content==editedJapanese&&http.EmbeddingInputs.Last().Contains(editedJapanese),"explicit original chunk correction feeds the combined-save embedding request");
    Check(await db.YoutubeTranscriptSegments.Where(s=>s.Id==japanese.Segments[0].Id).Select(s=>s.Text).SingleAsync()==japanese.Segments[0].Text,"chunk editing preserves raw original transcript segments");
    var pdfDoc=RagVectorDocuments.Build(new RagDocumentChunk{SourceType=SourceType.Pdf,SourceId=7,Content="PDF original text"});
    Check(pdfDoc.ModelKey==RagVectorDocuments.ModelKey&&pdfDoc.Content=="PDF original text","PDF embedding version and input policy remain unchanged");
    Console.WriteLine("PASS all chunk + embedding consistency checks; original application DB and Weaviate untouched");
}
finally
{
    NpgsqlConnection.ClearAllPools();
    if(!System.Text.RegularExpressions.Regex.IsMatch(database,"^ragyt_chunkchecks_[a-f0-9]{32}$"))throw new Exception("Unsafe cleanup target");
    await new NpgsqlCommand($"DROP DATABASE {database} WITH (FORCE)",admin).ExecuteNonQueryAsync();
}
static void Check(bool value,string description) {if(!value)throw new Exception(description);Console.WriteLine("PASS "+description);}
static async Task Expect503(Func<Task<UpdatedTranscriptChunk>> operation) {try{await operation();throw new Exception("Expected 503");}catch(TranscriptManagementException error)when(error.StatusCode==503){}}
sealed class FakeFactory(FakeHttp handler):IHttpClientFactory {public HttpClient CreateClient(string name)=>new(handler,false);}
sealed class FakeHttp:HttpMessageHandler
{
    public Dictionary<string,JsonNode> Objects {get;}=[];
    public bool FailEmbedding,FailWrite,FailDelete;public int EmbeddingCalls;
    public List<string> EmbeddingInputs {get;}=[];
    public static float[] Vector {get;}=Enumerable.Range(0,1024).Select(i=>i==0?1f:0f).ToArray();
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken token)
    {
        var path=request.RequestUri!.AbsolutePath;object result=new{};
        if(path=="/embed")
        {
            EmbeddingCalls++;if(FailEmbedding)return new(HttpStatusCode.ServiceUnavailable);
            var body=await request.Content!.ReadFromJsonAsync<JsonNode>(cancellationToken:token);var count=body!["texts"]!.AsArray().Count;
            EmbeddingInputs.AddRange(body["texts"]!.AsArray().Select(t=>t!.GetValue<string>()));
            result=new EmbeddingResult(RagVectorDocuments.Model,RagVectorDocuments.Revision,1024,"cpu",Enumerable.Repeat(Vector,count).ToArray(),new int[count],Enumerable.Repeat(1,count).ToArray());
        }
        else if(path=="/v1/batch/objects")
        {
            if(FailWrite)return new(HttpStatusCode.ServiceUnavailable);
            var body=await request.Content!.ReadFromJsonAsync<JsonNode>(cancellationToken:token);
            foreach(var item in body!["objects"]!.AsArray()){Objects[item!["id"]!.GetValue<string>()]=item.DeepClone();}
            result=new[]{new{result=new{status="SUCCESS"}}};
        }
        else if(path=="/v1/objects") result=new{objects=request.RequestUri.Query.Contains("after=")?Array.Empty<JsonNode>():Objects.Values.ToArray()};
        else if(request.Method==HttpMethod.Delete)
        {
            if(FailDelete)return new(HttpStatusCode.ServiceUnavailable);
            Objects.Remove(path.Split('/').Last());
        }
        else if(path=="/v1/graphql")
        {
            var values=Objects.Values.Select(v=>v["properties"]!.DeepClone()).ToArray();
            result=new Dictionary<string,object>{{"data",new Dictionary<string,object>{{"Get",new Dictionary<string,object>{{WeaviateVectorStore.TextClass,values}}}}}};
        }
        return new(HttpStatusCode.OK){Content=JsonContent.Create(result)};
    }
}
sealed class CheckEnvironment:IWebHostEnvironment
{
    public string ApplicationName{get;set;}="checks";public string EnvironmentName{get;set;}="Development";public string ContentRootPath{get;set;}="";
    public string WebRootPath{get;set;}="";public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();
}
sealed class CheckLifetime:IHostApplicationLifetime
{
    public CancellationToken ApplicationStarted=>default;public CancellationToken ApplicationStopping=>default;public CancellationToken ApplicationStopped=>default;public void StopApplication(){}
}
