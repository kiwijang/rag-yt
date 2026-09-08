using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Models;

namespace Rag.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public DbSet<YoutubeSource> YoutubeSources { get; set; }
    public DbSet<PdfSource> PdfSources { get; set; }
    public DbSet<RagDocumentChunk> RagDocumentChunks { get; set; }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.LastName).HasMaxLength(100);
        });

        builder.Entity<YoutubeSource>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.Property(x => x.ChannelId).HasMaxLength(200);
            entity.Property(x => x.Url).IsRequired().HasMaxLength(500);
            entity.Property(x => x.ThumbnailUrl).HasMaxLength(500);
            entity.Property(x => x.ChannelName).HasMaxLength(200);
        });

        builder.Entity<PdfSource>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.Property(x => x.FileName).HasMaxLength(200);
            entity.Property(x => x.Url).IsRequired().HasMaxLength(500);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<RagDocumentChunk>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SourceName).IsRequired().HasMaxLength(200);
            entity.Property(x => x.Content).IsRequired();
            entity.Property(x => x.MetadataJson).HasMaxLength(4000);
            entity.HasIndex(x => new { x.SourceType, x.SourceId });
            entity.HasIndex(x => x.CreatedAt);
        });
    }
}
