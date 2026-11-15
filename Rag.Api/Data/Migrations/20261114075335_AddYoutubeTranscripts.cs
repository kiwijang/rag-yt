using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Rag.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddYoutubeTranscripts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "YoutubeTranscriptSegmentId",
                table: "RagDocumentChunks",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "YoutubeTranscripts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    YoutubeSourceId = table.Column<int>(type: "integer", nullable: false),
                    VideoId = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Language = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Origin = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EngineVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_YoutubeTranscripts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_YoutubeTranscripts_YoutubeSources_YoutubeSourceId",
                        column: x => x.YoutubeSourceId,
                        principalTable: "YoutubeSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "YoutubeTranscriptSegments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    YoutubeTranscriptId = table.Column<int>(type: "integer", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    StartSeconds = table.Column<double>(type: "double precision", nullable: false),
                    EndSeconds = table.Column<double>(type: "double precision", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false),
                    TraditionalChineseText = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_YoutubeTranscriptSegments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_YoutubeTranscriptSegments_YoutubeTranscripts_YoutubeTranscr~",
                        column: x => x.YoutubeTranscriptId,
                        principalTable: "YoutubeTranscripts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RagDocumentChunks_YoutubeTranscriptSegmentId",
                table: "RagDocumentChunks",
                column: "YoutubeTranscriptSegmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_YoutubeTranscripts_YoutubeSourceId_VideoId_Id",
                table: "YoutubeTranscripts",
                columns: new[] { "YoutubeSourceId", "VideoId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_YoutubeTranscriptSegments_YoutubeTranscriptId_Sequence",
                table: "YoutubeTranscriptSegments",
                columns: new[] { "YoutubeTranscriptId", "Sequence" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_RagDocumentChunks_YoutubeTranscriptSegments_YoutubeTranscri~",
                table: "RagDocumentChunks",
                column: "YoutubeTranscriptSegmentId",
                principalTable: "YoutubeTranscriptSegments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RagDocumentChunks_YoutubeTranscriptSegments_YoutubeTranscri~",
                table: "RagDocumentChunks");

            migrationBuilder.DropTable(
                name: "YoutubeTranscriptSegments");

            migrationBuilder.DropTable(
                name: "YoutubeTranscripts");

            migrationBuilder.DropIndex(
                name: "IX_RagDocumentChunks_YoutubeTranscriptSegmentId",
                table: "RagDocumentChunks");

            migrationBuilder.DropColumn(
                name: "YoutubeTranscriptSegmentId",
                table: "RagDocumentChunks");
        }
    }
}
