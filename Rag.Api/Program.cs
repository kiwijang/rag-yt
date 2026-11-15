using Duende.IdentityServer;
using Duende.IdentityServer.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Rag.Api.Data;
using Rag.Api.Models;
using Rag.Api.Services;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var jwtKey = builder.Configuration["Jwt:Key"] ?? "RagYt-Development-Key-Should-Be-Changed-For-Production!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "http://localhost:5085";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ragyt-api";

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=ragyt;Username=ragyt;Password=ragyt123";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

builder.Services
    .AddIdentityServer(options =>
    {
        options.Events.RaiseErrorEvents = true;
        options.Events.RaiseInformationEvents = true;
        options.Events.RaiseFailureEvents = true;
        options.Events.RaiseSuccessEvents = true;
    })
    .AddAspNetIdentity<ApplicationUser>()
    .AddInMemoryApiScopes(new[]
    {
        new ApiScope("ragapi.read", "Read access to RAG API"),
        new ApiScope("ragapi.write", "Write access to RAG API")
    })
    .AddInMemoryApiResources(new[]
    {
        new ApiResource("ragapi")
        {
            Scopes = { "ragapi.read", "ragapi.write" },
            ApiSecrets = { new Secret("ragapi-secret".Sha256()) }
        }
    })
    .AddInMemoryClients(new[]
    {
        new Client
        {
            ClientId = "angular-client",
            ClientName = "Angular Client",
            AllowedGrantTypes = GrantTypes.Code,
            RequirePkce = true,
            RedirectUris = { "http://localhost:4200" },
            PostLogoutRedirectUris = { "http://localhost:4200" },
            AllowedScopes = { IdentityServerConstants.StandardScopes.OpenId, IdentityServerConstants.StandardScopes.Profile, "ragapi.read", "ragapi.write" },
            AllowOfflineAccess = true,
            ClientSecrets = { new Secret("angular-secret".Sha256()) }
        }
    });

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        NameClaimType = "name",
        RoleClaimType = ClaimTypes.Role
    };
});

builder.Services.AddAuthorization();
builder.Services.AddHttpClient<YoutubeSyncService>();
builder.Services.AddScoped<YoutubeTranscriptionService>();
builder.Services.AddScoped<TranscriptChunkManagementService>();
builder.Services.AddSingleton<YoutubeMediaService>();
builder.Services.AddScoped<YoutubeVideoMetadataStore>();
builder.Services.AddSingleton<YoutubeMetadataQueue>();
builder.Services.AddHostedService(services => services.GetRequiredService<YoutubeMetadataQueue>());
builder.Services.AddSingleton<GpuInferenceService>();
builder.Services.AddHostedService(services => services.GetRequiredService<GpuInferenceService>());
builder.Services.AddSingleton<YoutubeTranscriptQueue>();
builder.Services.AddHostedService(services => services.GetRequiredService<YoutubeTranscriptQueue>());
builder.Services.AddScoped<PdfOcrService>();
builder.Services.AddScoped<RagSearchService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend4200", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "RAG YT API",
        Version = "v1",
        Description = "使用順序：登入取得 accessToken → Authorize → 建立來源 → 同步影片清單 → 讀取逐字稿或建立背景批次 → 輪詢進度 → 搜尋片段。管理操作需 Admin。各端點包含用途、用法及資料影響；Execute 會實際執行操作。"
    });

    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "先呼叫 POST /api/Auth/login，再貼上 accessToken 本身；Swagger 自動加入 Bearer 前綴。",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Id = "Bearer",
            Type = ReferenceType.SecurityScheme
        }
    };

    options.AddSecurityDefinition("Bearer", jwtSecurityScheme);
    options.OperationFilter<Rag.Api.OpenApi.ApiDocumentationFilter>();
    options.SchemaFilter<Rag.Api.OpenApi.RequestDocumentationFilter>();
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();
    await AuthSeedService.SeedAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();
app.UseRouting();
app.UseCors("Frontend4200");
app.UseIdentityServer();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
