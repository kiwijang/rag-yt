using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace Rag.Api.Data.Migrations;
public partial class RecordYoutubeTranscriptTiming : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<double>(name: "DownloadSeconds", table: "YoutubeTranscripts", type: "double precision", nullable: true);
        migrationBuilder.AddColumn<double>(name: "ProcessingSeconds", table: "YoutubeTranscripts", type: "double precision", nullable: true);
        migrationBuilder.AddColumn<double>(name: "TranscriptionSeconds", table: "YoutubeTranscripts", type: "double precision", nullable: true);
        migrationBuilder.AddColumn<double>(name: "TranslationSeconds", table: "YoutubeTranscripts", type: "double precision", nullable: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "DownloadSeconds", table: "YoutubeTranscripts");
        migrationBuilder.DropColumn(name: "ProcessingSeconds", table: "YoutubeTranscripts");
        migrationBuilder.DropColumn(name: "TranscriptionSeconds", table: "YoutubeTranscripts");
        migrationBuilder.DropColumn(name: "TranslationSeconds", table: "YoutubeTranscripts");
    }
}