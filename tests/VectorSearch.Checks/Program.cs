using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Rag.Api.Services;

// Uses a unique temporary Weaviate class. Never modifies PostgreSQL or production collections.
var services=new ServiceCollection();
services.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddEnvironmentVariables().Build());
services.AddHttpClient("Weaviate");
services.AddSingleton<WeaviateVectorStore>();
using var provider=services.BuildServiceProvider();
var store=provider.GetRequiredService<WeaviateVectorStore>();
using var client=new HttpClient {Timeout=TimeSpan.FromMinutes(30)};
var endpoint=Environment.GetEnvironmentVariable("Embeddings__ServiceUrl")??"http://127.0.0.1:8091";
var collection="RagChecks"+Guid.NewGuid().ToString("N");
var imageCollection="RagChecks"+Guid.NewGuid().ToString("N");
var token=CancellationToken.None;
async Task<EmbeddingResult> Encode(string[] texts,string model,string device)
{
    using var response=await client.PostAsJsonAsync(endpoint+"/embed",new {id=Guid.NewGuid().ToString("N"),texts,model,device});
    response.EnsureSuccessStatusCode();
    var result=(await response.Content.ReadFromJsonAsync<EmbeddingResult>())!;
    if(result.Vectors.Length!=texts.Length||result.Vectors.Any(v=>v.Length!=1024||Math.Abs(v.Sum(x=>x*x)-1)>0.01)) throw new Exception("Invalid embedding dimensions/norm");
    Console.WriteLine($"PASS {model}: {device} -> {result.Device}, {result.Vectors.Length} normalized vectors");
    return result;
}
try
{
    var texts=new[]{"臀中肌可以穩定骨盆，減少走路時身體搖晃。","PostgreSQL 是關聯式資料庫，可以使用 SQL 儲存與查詢資料。","貓咪在窗邊睡覺。"};
    var bge=await Encode(texts,"bge-m3","gpu");
    var query=await Encode(["歩行中に骨盤を安定させる筋肉"],"bge-m3","cpu");
    await store.EnsureAsync(collection,token);
    for(var i=0;i<texts.Length;i++) await store.UpsertAsync(collection,i+1,2,99,1,texts[i],"hash"+i,RagVectorDocuments.ModelKey,bge.Vectors[i],token);
    var ranked=await store.SearchAsync(collection,query.Vectors[0],"骨盤",2,99,3,true,token);
    if(ranked.FirstOrDefault()?.Id!=1) throw new Exception("Japanese to Chinese retrieval failed");
    Console.WriteLine("PASS Japanese query retrieves Chinese muscle document via Weaviate hybrid search");
    var excluded=await store.SearchAsync(collection,query.Vectors[0],"骨盤",2,100,3,false,token);
    if(excluded.Length!=0) throw new Exception("Source filter leaked results");
    await store.UpsertAsync(collection,1,2,99,1,texts[0],"updated",RagVectorDocuments.ModelKey,bge.Vectors[0],token);
    var listed=await store.ListAsync(collection,token);
    if(listed.Count!=3||listed[1].Hash!="updated") throw new Exception("Idempotent upsert failed");
    await store.DeleteAsync(collection,3,token);
    if((await store.ListAsync(collection,token)).Count!=2) throw new Exception("Delete failed");
    Console.WriteLine("PASS source filter, deterministic upsert, hash update and deletion");
    await Encode(["圖像中有什麼？","画像には何がありますか？"],"jina-clip-v2","cpu");
    if(args.Length>0)
    {
        using var form=new MultipartFormDataContent();form.Add(new StringContent("gpu"),"device");
        form.Add(new StreamContent(File.OpenRead(args[0])),"files","page.png");
        using var response=await client.PostAsync(endpoint+"/embed-images",form);response.EnsureSuccessStatusCode();
        var image=(await response.Content.ReadFromJsonAsync<EmbeddingResult>())!;
        if(image.Model!="jinaai/jina-clip-v2"||image.Vectors.Length!=1||image.Vectors[0].Length!=1024||image.Device!="cuda") throw new Exception("Jina image inference failed");
        await store.EnsureAsync(imageCollection,token);
        await store.UpsertAsync(imageCollection,7,2,99,1,"PDF page","image",WeaviateVectorStore.JinaKey,image.Vectors[0],token);
        var jinaQuery=await Encode(["一本書的頁面"],"jina-clip-v2","cpu");
        var found=await store.SearchAsync(imageCollection,jinaQuery.Vectors[0],"",2,99,3,false,token);
        if(!found.Any(hit=>hit.Id==7)) throw new Exception("Image vector not retrievable");
        Console.WriteLine("PASS real PDF page GPU image embedding + CPU text-to-image Weaviate retrieval");
    }
}
finally
{
    // Strictly scope cleanup to the random test collection generated in this process.
    foreach(var target in new[]{collection,imageCollection}) {
    if(!System.Text.RegularExpressions.Regex.IsMatch(target,"^RagChecks[a-f0-9]{32}$")) throw new Exception("Unsafe cleanup target");
    var weaviate=Environment.GetEnvironmentVariable("Weaviate__Url")??"http://127.0.0.1:8080";
    using var response=await client.DeleteAsync(weaviate+"/v1/schema/"+target);
    if(!response.IsSuccessStatusCode && response.StatusCode!=System.Net.HttpStatusCode.NotFound) response.EnsureSuccessStatusCode();
    }
}
