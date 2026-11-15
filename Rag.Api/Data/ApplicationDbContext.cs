using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Rag.Api.Models;

namespace Rag.Api.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public DbSet<YoutubeSource> YoutubeSources { get; set; }
    public DbSet<PdfPage> PdfPages { get; set; }
    public DbSet<PdfSource> PdfSources { get; set; }
    public DbSet<RagDocumentChunk> RagDocumentChunks { get; set; }
    public DbSet<YoutubeTranscript> YoutubeTranscripts { get; set; }
    public DbSet<YoutubeTranscriptSegment> YoutubeTranscriptSegments { get; set; }

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

        builder.Entity<YoutubeTranscript>(entity =>
        {
            entity.Property(x => x.VideoId).HasMaxLength(11);
            entity.Property(x => x.Language).HasMaxLength(16);
            entity.Property(x => x.Origin).HasMaxLength(40);
            entity.Property(x => x.Model).HasMaxLength(200);
            entity.Property(x => x.EngineVersion).HasMaxLength(40);
            entity.HasIndex(x => new { x.YoutubeSourceId, x.VideoId, x.Id });
        });

        builder.Entity<YoutubeTranscriptSegment>()
            .HasIndex(x => new { x.YoutubeTranscriptId, x.Sequence }).IsUnique();

        builder.Entity<PdfPage>(entity =>
        {
            entity.HasIndex(x => new { x.PdfSourceId, x.PageNumber }).IsUnique();
            entity.HasOne(x => x.PdfSource).WithMany(x => x.Pages).HasForeignKey(x => x.PdfSourceId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<RagDocumentChunk>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SourceName).IsRequired().HasMaxLength(200);
            entity.Property(x => x.Content).IsRequired();
            entity.Property(x => x.MetadataJson).HasMaxLength(4000);
            entity.HasIndex(x => new { x.SourceType, x.SourceId });
            entity.HasIndex(x => x.CreatedAt);
            entity.HasOne(x => x.PdfSource).WithMany(x => x.Chunks).HasForeignKey(x => x.PdfSourceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.PdfPage).WithMany(x => x.Chunks).HasForeignKey(x => x.PdfPageId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.YoutubeTranscriptSegment).WithOne()
                .HasForeignKey<RagDocumentChunk>(x => x.YoutubeTranscriptSegmentId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
