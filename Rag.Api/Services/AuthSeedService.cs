using Microsoft.AspNetCore.Identity;
using Rag.Api.Data;
using Rag.Api.Models;

namespace Rag.Api.Services;

public static class AuthSeedService
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var db = services.GetRequiredService<ApplicationDbContext>();

        foreach (var role in new[] { "Admin", "User" })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var adminEmail = "admin@ragyt.local";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                FirstName = "System",
                LastName = "Admin"
            };

            var result = await userManager.CreateAsync(adminUser, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }

        var normalUserEmail = "user@ragyt.local";
        var normalUser = await userManager.FindByEmailAsync(normalUserEmail);
        if (normalUser == null)
        {
            normalUser = new ApplicationUser
            {
                UserName = normalUserEmail,
                Email = normalUserEmail,
                EmailConfirmed = true,
                FirstName = "Demo",
                LastName = "User"
            };

            var result = await userManager.CreateAsync(normalUser, "User123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(normalUser, "User");
            }
        }

        if (!db.YoutubeSources.Any())
        {
            db.YoutubeSources.AddRange(
                new YoutubeSource
                {
                    Name = "AI Weekly",
                    ChannelId = "UCxqkL7h2x6M0P7mX3v2wFg",
                    ChannelName = "AI Weekly",
                    Url = "https://www.youtube.com/@aiweekly",
                    ThumbnailUrl = "https://example.com/aiweekly.jpg",
                    Description = "Weekly AI insights and tools.",
                    IsActive = true,
                    Status = SourceStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new YoutubeSource
                {
                    Name = "Tech Deep Dive",
                    ChannelId = "UCuR3JQ4X9c8L0nJ5S2yQ8kA",
                    ChannelName = "Tech Deep Dive",
                    Url = "https://www.youtube.com/@techdeepdive",
                    ThumbnailUrl = "https://example.com/techdeepdive.jpg",
                    Description = "Engineering and architecture videos.",
                    IsActive = true,
                    Status = SourceStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
        }

        if (!db.PdfSources.Any())
        {
            db.PdfSources.AddRange(
                new PdfSource
                {
                    Name = "RAG System Design",
                    FileName = "rag-system-design.pdf",
                    Url = "https://example.com/files/rag-system-design.pdf",
                    Description = "Core architecture notes for RAG pipeline.",
                    IsActive = true,
                    Status = SourceStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new PdfSource
                {
                    Name = "Prompt Engineering Guide",
                    FileName = "prompt-engineering-guide.pdf",
                    Url = "https://example.com/files/prompt-engineering-guide.pdf",
                    Description = "Prompt best practices and examples.",
                    IsActive = true,
                    Status = SourceStatus.Active,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
        }

        await db.SaveChangesAsync();
    }
}
